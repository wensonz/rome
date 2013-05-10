/**
 * This module implements the basic and simple startup function to initialize
 * and run an application with the specified config.
 * 
 * @module caligula.startup.simple
 */
Condotti.add('caligula.startup.simple', function (C) {

    function bootstrap (config, callback) {
        var file = null,
            json = null,
            base = null,
            message = null;
        
        // default basic config
        base = {
            'condotti': {
                'loader': {
                    'baseUrl': C.process.cwd(),
                    'paths': {
                        'caligula': C.natives.path.resolve(__dirname, '../'),
                        'caligula.components': './components'
                    }
                }
            }
        };
        
        C.lang.merge(base, config);
        C.lang.merge(config, base);
        
        /* Loading the application specific configuration from config.json under
         * current directory
         */
        file = C.natives.path.resolve(C.process.cwd(), 'config.json');
        if (!C.natives.fs.existsSync(file)) {
            C.warn('Application specified configuration file ' + file + 
                   ' does not exist.');
        } else {
            message = 'Loading application-specific configuration from "' + 
                      file + '"';
            C.debug(message + ' ...');
            
            try {
                json = require(file);
                C.lang.merge(config, json);
            } catch (e) {
                C.error(message + ' failed. Error: ' + e.toString());
                // TODO: throw new customized error
                throw e;
            }
            
            C.info(message + ' succeed.');
            C.debug('Merged config: ' + C.lang.reflect.inspect(config));
        }
        
        message = 'Bootstraping new Condotti instance';
        C.debug(message + ' ...');
        
        Condotti(config.condotti).use(
            'caligula.startup.simple', 
            function (error, result) {
                if (error) {
                    C.error(message + ' failed. Error: ' + error.toString());
                    callback(error);
                    return;
                }
                
                C.info(message + ' succeed.');
                callback(null, result);
            }
        );
    }
    
    C.namespace('caligula.startup').bootstrap = bootstrap;
    
    /**
     * Start the basic and simple application with the specified config.
     * 
     * @method start
     * @param {Object} config the config for this startup
     * @param {Function} callback the callback function to be invoked when the
     *                            application stops successfully, or some error
     *                            occurs. The signature of the callback is
     *                            'function (error, result) {}'
     */
    function start (config, callback) {
        var factory = null,
            message = null;
        
        // TODO: param check
        C.async.waterfall([
            function (next) {
                message = 'Loading modules ' + 
                          C.lang.reflect.inspect(config.modules);
                
                C.debug(message + ' ...');
                                  
                C.use(config.modules, next);
            },
            function (unused, next) {
                C.info(message + ' succeed.');
                
                message = 'Initializing dotti factory with ' +
                          C.lang.reflect.inspect(config.dotti);
                          
                C.debug(message + ' ...');
                
                try {
                    factory = new C.di.DottiFactory(config.dotti);
                } catch (e) {
                    next(e);
                }
                
                factory.set('dotti-factory', factory);
                next();
                
            },
            function (next) {
                var loader = null;
                
                C.info(message + ' succeed.');
                
                message = 'Getting the component loader';
                C.debug(message + ' ...');
                try {
                    loader = factory.get('component-loader');
                } catch (e) {
                    next(e);
                    return;
                }
                
                if (!loader) {
                    C.warn('Component loader is not specified.');
                    next();
                    return;
                }
                
                C.debug(message + ' succeed.');
                
                message = 'Loading all components via component loader';
                C.debug(message + ' ...');
                
                loader.loadAll(next);
            },
            function (next) {
                var app = null;
                
                C.info(message + ' succeed.');
                
                message = 'Application is being started';
                C.debug(message + ' ...');
                
                app = factory.get('app');
                app.run();
                next();
            }
        ], function (error) {
                
                if (error) {
                    C.error(message + ' failed. Error: ' +
                            C.lang.reflect.inspect(error));
                    callback(error);
                    return;
                }
                
                C.info('Application is running now.');
        });    
    }
    
    C.namespace('caligula.startup').start = start;

}, '0.0.1', { requires: [] });
