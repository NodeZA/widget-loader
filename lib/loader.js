"use strict";

var _ = require('lodash');
var sequence = require('when/sequence');
var path = require('path');
var fs = require('fs');
var WidgetSandbox = require('ghost-sandbox');
var WidgetCollection = [];




module.exports = function (opts) {

  var App = opts.App;
  var widgetDir = opts.widgetDir;
  var SlimAppCopy = App.widgetAPI();


  // Load apps through a psuedo sandbox
  function loadWidget(widgetPath) {
    var opts = App.getConfig('widget') || {};
    var sandbox = new WidgetSandbox(opts);
  
    return sandbox.loadWidget(widgetPath);
  }
  
  
  function getWidget(name) {
    // Grab the app class to instantiate
    var AppClass = loadWidget(path.join(widgetDir, name));
    var app;
    
    // Check for an actual class, otherwise just use whatever was returned
    if (_.isFunction(AppClass)) {
      app = new AppClass();
    } else {
      app = AppClass;
    }
    
    return app;
  }
  
  
  function getTemplate(widgetName) {
    var templatePath = path.join(widgetDir, widgetName, 'template.hbs');
  
    return fs.readFileSync(templatePath, 'utf8');
  }
  
  
  // loop through the widgets directory and load widgets with templates
  function buildWidgets() {
    var currentWidget;
  
    function build(widgetName) {
      fs.lstat(path.join(widgetDir, widgetName), function(err, stat) {
        if (stat.isDirectory()) {
          currentWidget = getWidget(widgetName);
          currentWidget.template = getTemplate(widgetName);
          WidgetCollection.push(currentWidget);
        }
      });
    }
  
    // loops through the widgets directory
    fs.readdir(widgetDir, function(err, widgets) {
      widgets.forEach(build);
    });
  }
  
  
  function matchPaths(urlPath, widgetPath) {
  
    if (urlPath === widgetPath) {
      return true;
    }
  
    var urlArr = urlPath.split('/');
    var widgetArr = widgetPath.split('/');
    var isMatch = false;
  
    if (urlArr.length !== widgetArr.length) {
      return false;
    }
  
    if (widgetArr[widgetArr.length - 1] === ':any') {
      widgetArr[widgetArr.length - 1] = urlArr[urlArr.length - 1];
    }
  
    return urlArr.join('') === widgetArr.join('');
  }
  
  
  function matchRoute(routes, page) {
    if (routes.length === 0 || routes.indexOf(page) > -1) {
      return true;
    }
  
    var isMatch = false;
    var i;
  
    for (i = 0; i < routes.length; i++) {
      isMatch = matchPaths(page, routes[i]);
  
      if (isMatch) {
        break;
      }
    }
  
    return isMatch;
  }
  
  
  function sortWidgets (widgetCollection) {
    var widgetPositions = _.keys(widgetCollection);
  
    _.each(widgetPositions, function (key) {
      widgetCollection[key].sort(function (obj1, obj2) {
        return obj1.config.order - obj2.config.order;
      });
    });
  
    return widgetCollection;
  }
  
  
  // load widgets before any requests can come
  buildWidgets();


  return function (req, res, next) {

    //console.log('Widget middlware called');
    //console.time('middlware');
    var CurrentWidgetCollection = {}; // holds current widgets
    var widgetOps = [];
    var filteredWidgets = [];

    // filter and get widgets for only this specific page
    filteredWidgets = _.filter(WidgetCollection, function (widget) {
      return widget.config.active && matchRoute(widget.config.routes, req.path);
    });

    // execute widget request and extract return data
    widgetOps = _.map(filteredWidgets, function (widget) {
      return function () {
        return widget.exec(SlimAppCopy)
        .then(function (collection) {

          if (collection && !collection.models) {
            throw new Error(widget.config.name + ' module does not return a collection');
          }

          var widgetTemplate = {};
          var position = widget.config.position;

          widgetTemplate.template = widget.template;
          widgetTemplate.config = widget.config;
          widgetTemplate.collection = collection;

          if (!_.isArray(CurrentWidgetCollection[position])) {
            CurrentWidgetCollection[position] = [];
          }

          CurrentWidgetCollection[position].push(widgetTemplate);

          return widgetTemplate;
        })
        .otherwise(function (error) {
          console.error(error);
          next(error);
          //req.flash('error', { msg: error.message });
        });
      };
    });

    // when widgets are loaded, continue
    sequence(widgetOps)
    .then(function () {
      //console.timeEnd('middlware');
      // add widgets to template
      res.locals.WidgetCollection = sortWidgets(CurrentWidgetCollection);
      next();
    })
    .otherwise(function (error) {
      console.error(error);
      next(error);
    });
  };
};

