

/**
 * Base class of the configuration processors
 *
 * @class ConfigurationProcessor
 */
function ConfigurationProcessor() {
    'use strict';
    //
}

ConfigurationProcessor.prototype.process = function (configuration, callback) {
    'use strict';
    callback(new Error('Not implemented'));
};

module.exports.ConfigurationProcessor = ConfigurationProcessor;
