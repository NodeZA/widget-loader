"use strict";

const should = require('chai').should();
const path = require('path');
const request = require('supertest');
const widgetLoader = require('../');
const widgetDir = path.join(__dirname, './widgets');
let server = null;


const App = {
  getConfig: function () {
    return false;
  },

  widgetAPI: function () {
    return {};
  }
};


describe('Widget Loader', function(){

  before(function(done) {
    let express = require('express');
    let expressApp = express();

    expressApp.use(widgetLoader(App, {
      widgetDirectory: widgetDir
    }));

    expressApp.get('/', function (req, res) {
      res.json(res.locals.WidgetCollection);
    });

    server = expressApp.listen(3004, function () {
      console.log(`Example app listening at http://localhost:3004`);
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
