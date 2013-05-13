/**
 * This module implements a simple startup using the caligula application
 * framework.
 * 
 * @module caligula
 */
var condotti = require('condotti'),
    natives = require('natives'),
    defaults = require('./config/defaults.json');

function bootstrap (config, callback) {
    var C = null,
        merged = {},
        base = null;
    
    C = new condotti.Condotti();
    // TODO: use C.validators to check the param
    
    base = {
        'loader': {
            'baseUrl': process.cwd(),
            'paths': {
                'caligula': natives.path.resolve(__dirname, 'lib'),
            }
        }
    };
    
    C.lang.merge(base, defaults, config);
    config = base;
    
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
module.exports.defaults = defaults;
