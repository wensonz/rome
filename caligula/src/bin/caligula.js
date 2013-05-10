/**
 * This module implements a simple startup using the caligula application
 * framework.
 * 
 * @module caligula
 */

var condotti = require('condotti'),
    natives = require('natives');


function chaos (config, callback) {
    
    var C = null,
        base = null,
        message = null;
    
    // default basic config
    base = {
        'loader': {
            'baseUrl': process.cwd(),
            'paths': {
                'caligula': natives.path.resolve(__dirname, '../lib'),
            }
        },
        'condotti.server.logging': { 'level': 'INFO' }
    };
    
    C = condotti.Condotti(base); // a bootstrap Condotti instance for helping 
                                 // initialize the working Condotti instance, such
                                 // as loading the necessary config files, etc.
    
    C.async.waterfall([
        function (next) {
            message = 'Loading caligula.startup.simple';
            C.debug(message + ' ...');
            C.use('caligula.startup.simple', next);
        },
        function (C, next) {
            C.debug(message + ' succeed.');
            
            message = 'Bootstrap new Condotti instance';
            C.debug(message + ' ...');
            C.startup.bootstrap(config, next);
        }
    ], function (error, result) {
        if (error) {
            C.debug(message + ' failed. Error: ' + 
                    C.lang.reflect.inspect(error));
            callback(error);
            return;
        }
        
        C.debug(message + ' succeed.');
        callback(null, result);
    });
}


module.exports = function (config, callback) {
    
    chaos(config, function (error, C) {
        if (error) {
            callback(error);
            return;
        }
        
        C.startup.start(config, callback);
    });
};
