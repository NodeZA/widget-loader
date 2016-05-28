"use strict";

const config = require('./config.json');
const when = require('when');

module.exports.config = config;

module.exports.exec = function (App) {
  return when(null);
};
