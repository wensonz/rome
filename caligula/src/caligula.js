/**
 * This module implements a simple startup using the caligula application
 * framework.
 * 
 * @module caligula
 */
var condotti = require('condotti'),
    natives = require('natives');

function bootstrap (config, callback) {
    var C = null;
    
    if (!config.condotti) {
        callback(new TypeError('Configuration for Condotti instance is ' +
                               'expected to be property of the passed-in ' +
                               'param "config" with name "condotti", but' +
                               Object.prototype.toString.call(config.condotti) +
                               ' is found.'));
        return;
    }
    
    if ('object' !== typeof config.condotti) {
        callback(new TypeError('Configuration for Condotti instance is ' +
                               'expected to be an object, but a ' + 
                               (typeof config.condotti) + ' is found.'));
        return;
    }
    
    config.condotti.loader = config.condotti.loader || {};
    // overwrite the baseUrl
    config.condotti.loader.baseUrl = process.cwd();
    // overwrite the caligula path
    config.condotti.loader.paths = config.condotti.loader.paths || {};
    config.condotti.loader.paths.caligula = natives.path.resolve(__dirname, 
                                                                 'lib');
    
    C = new condotti.Condotti(config.condotti);
    
    if (!Array.isArray(config.modules) || config.modules.length === 0) {
        C.warn('Modules to be loaded for this Condotti instance is not ' +
               'specified.');
        callback(null, C);
        return;
    }
    
    C.use(config.modules, callback);
}

module.exports.bootstrap = bootstrap;
