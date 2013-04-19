#!/usr/bin/env node

var condotti = require('condotti'),
    natives = require('natives');

/**
 * Bootstrap the environment by loading the config.json under the current
 * working directory and merge the config with default ones. After that a new
 * Condotti instance based on the merged config is returned.
 *
 * @method bootstrap
 * @param {Object} config the default configuration items
 * @return {Condotti} a new created Condotti instance based on the merged
 *                    configuration items.
 */
function bootstrap(config) {
    var C = null,
        file = null,
        json = null;
    
    C = condotti.Condotti(); // a bootstrap Condotti instance for helping 
                             // initialize the working Condotti instance, such
                             // as loading the necessary config files, etc.
    
    /* Loading the default configuration from ../config/default.json */
    try {
        file = C.natives.path.resolve(__dirname, '../config/default.json');
        json = C.require(file);
    } catch (e) {
        C.error('Loading default configurations from ' + file + 
                    ' failed. Error: ' + e.toString());
        process.exit(1);
    }
    C.lang.merge(config, json);
    
    /* Loading the application specific configuration from config.json under
     * current directory
     */
    try {
        file = C.natives.path.resolve(process.cwd(), 'config.json');
        if (C.natives.fs.existsSync(file)) {
            json = require(file);
            C.lang.merge(config, json);
        }
    } catch (e) {
        C.error('Loading application-specific configuration from ' + file + 
                    ' failed. Error: ' + e.toString());
        process.exit(1);
    }
    
    C.info('Loading configuration succeed.');
    
    return condotti.Condotti(config.condotti);
}

/**
 * Entry point of this program, the main
 *
 * @method main
 */
function main () {
    
    var config = null,
        C = null;
    
    /* default configuration items */
    config = {
        'condotti': {
            'loader': {
                'baseUrl': process.cwd(),
                'paths': {
                    'caligula': natives.path.resolve(__dirname, '../lib'),
                    'caligula.components': './components'
                }
            }
        }
    };
    
    C = bootstrap(config);
    C.async.waterfall([
        function (next) {
            C.info('Loading modules ' + config.modules.toString() + ' ...');
            C.use(config.modules, function (error) {
                if (error) {
                    C.error('Loading modules ' + config.modules.toString() + 
                            ' failed. Error: ' + C.lang.reflect.inspect(error));
                    next(error);
                    return;
                }
                next();
            });
        },
        function (next) {
            var factory = null;
            
            C.info('Initializing dotti factory ...');
            factory = new C.di.DottiFactory(config.dotti);
            factory.set('dotti-factory', factory);
            
            next(null, factory);
        },
        function (factory, next) {
            var loader = null;
            loader = factory.get('component-loader');
            C.info('Loading all components via component loader ...');
            loader.loadAll(function (error) {
                if (error) {
                    C.error('Loading all components via loader failed. ' +
                            'Error: ' + C.lang.reflect.inspect(error));
                    next(error);
                    return;
                }
                next(null, factory);
            });
            
        }, function (factory, next) {
            var app = null;
            C.info('Application is going to run ...');
            app = factory.get('app');
            app.run();
        }
    ], function (error) {
        if (error) {
            process.exit(1);
        }
    });
}

/* calling main if this module is reuqired directly by node */
if (require.main === module) {
    main();
}
