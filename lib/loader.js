"use strict";

const _ = require('lodash');
const sequence = require('when/sequence');
const path = require('path');
const fs = require('fs');
const WidgetSandbox = require('ghost-sandbox');
const WidgetCollection = [];




module.exports = function (App, opts) {

  const widgetDir = opts.widgetDirectory;


  // Load apps through a psuedo sandbox
  function loadWidget(widgetPath) {
    let opts = App.getConfig('widget') || {};
    let sandbox = new WidgetSandbox(opts);

    return sandbox.loadWidget(widgetPath);
  }


  function getWidget(name) {
    // Grab the app class to instantiate
    let AppClass = loadWidget(path.join(widgetDir, name));
    let app;

    // Check for an actual class, catch just use whatever was returned
    if (_.isFunction(AppClass)) {
      app = new AppClass();
    } else {
      app = AppClass;
    }

    return app;
  }


  function getTemplate(widgetName) {
    let templatePath = path.join(widgetDir, widgetName, 'template.hbs');

    return fs.readFileSync(templatePath, 'utf8');
  }


  // loop through the widgets directory and load widgets with templates
  function buildWidgets() {
    let currentWidget;

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

    let urlArr = urlPath.split('/');
    let widgetArr = widgetPath.split('/');
    let isMatch = false;

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

    let isMatch = false;
    let i;

    for (i = 0; i < routes.length; i++) {
      isMatch = matchPaths(page, routes[i]);

      if (isMatch) {
        break;
      }
    }

    return isMatch;
  }


  function sortWidgets (widgetCollection) {
    let widgetPositions = _.keys(widgetCollection);

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
    let CurrentWidgetCollection = {}; // holds current widgets
    let widgetOps = [];
    let filteredWidgets = [];

    // filter and get widgets for only this specific page
    filteredWidgets = _.filter(WidgetCollection, function (widget) {
      return widget.config.active && matchRoute(widget.config.routes, req.path);
    });

    // execute widget request and extract return data
    widgetOps = _.map(filteredWidgets, function (widget) {
      return function () {
        return widget.exec(App)
        .then(function (collection) {

          if (collection && !collection.models) {
            throw new Error(widget.config.name + ' module does not return a collection');
          }

          let widgetTemplate = {};
          let position = widget.config.position;

          widgetTemplate.template = widget.template;
          widgetTemplate.config = widget.config;
          widgetTemplate.collection = collection;

          if (!_.isArray(CurrentWidgetCollection[position])) {
            CurrentWidgetCollection[position] = [];
          }

          CurrentWidgetCollection[position].push(widgetTemplate);

          return widgetTemplate;
        })
        .catch(function (error) {
          console.error(error);
          next(error);
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
    .catch(function (error) {
      console.error(error);
      next(error);
    });
  };
};
