/**
 * Base class of configuration output formatters
 * @class ConfigurationOutputFormatter
 */
function ConfigurationOutputFormatter() {
    'use strict';
}

ConfigurationOutputFormatter.prototype.format = function (output, callback) {
    'use strict';
    callback(new Error('Not implemented'));
};

module.exports.ConfigurationOutputFormatter = ConfigurationOutputFormatter;
