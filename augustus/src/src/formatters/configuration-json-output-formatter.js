var util = require('util'),
    log4js = require('log4js'),
    formatter = require('./configuration-output-formatter.js');

function ConfigurationJsonOutputFormatter() {
    'use strict';
    formatter.ConfigurationOutputFormatter.call(this);
    this.logger_ = log4js.getLogger('ConfigurationJsonOutputFormatter'); 
}

util.inherits(ConfigurationJsonOutputFormatter, formatter.ConfigurationOutputFormatter);

ConfigurationJsonOutputFormatter.prototype.format = function (output, callback) {
    'use strict';
    var self = this,
        content = null;
    try {
        content = JSON.stringify(output);
    } catch (error) {
        callback(error, null);
        return;
    }
    self.logger_.debug("Format configure has been successfully. " + 
                       "Result:" + util.inspect(content, false, null));
    callback(null, content);
};

module.exports.ConfigurationJsonOutputFormatter = ConfigurationJsonOutputFormatter;
