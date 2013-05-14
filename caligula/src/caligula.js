/**
 * This module implements a simple startup using the caligula application
 * framework.
 * 
 * @module caligula
 */
var path = require('path'),
    defaults = require('./config/defaults.json');

module.exports.path = path.resolve(__dirname, 'lib');
module.exports.defaults = defaults;
