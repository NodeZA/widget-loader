
var should = require('chai').should();
var path = require('path');
var request = require('supertest');
var widgetLoader = require('../');
var widgetDir = path.join(__dirname, './widgets');
var server = null;


var App = {
  getConfig: function () {
    return false;
  },

  widgetAPI: function () {
    return {};
  }
};


describe('Widget Loader', function(){

  before(function(done) {
    var express = require('express');
    var expressApp = express();

    expressApp.use(widgetLoader({
      App: App,
      widgetDir: widgetDir
    }));

    expressApp.get('/', function (req, res) {
      res.json(res.locals.WidgetCollection);
    });
    
    server = expressApp.listen(3004, function () {
    
      var host = server.address().address;
      var port = server.address().port;
    
      console.log('Example app listening at http://%s:%s', host, port);

      done();
    });
  });


  describe('GET /', function() {
    it('should return 200', function(done) {
      request(server)
        .get('/')
        .expect(200, done);
    });
  });
});