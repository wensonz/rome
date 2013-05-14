/**
 * This module contains the implementation of the RomeHandler, which is designed
 * to handle the CLI request for HTTP API server of project ROME.
 * 
 * @module caligula.handlers.rome
 */
Condotti.add('caligula.handlers.rome', function (C) {

    /**
     * This RomeHandler is a child class of Handler, and designed to handle the
     * CLI request for HTTP API server of project ROME.
     * 
     * @class RomeHandler
     * @constructor
     * @extends Handler
     * @param {Object} config the config object for this handler
     */
    function RomeHandler (config) {
        /* inheritance */
        this.super();
        
        /**
         * The config object for this handler
         * 
         * @property config_
         * @type Object
         */
        this.config_ = config;
        
        /**
         * The application for this HTTP API server
         * 
         * @property app_
         * @type App
         * @default null
         */
        this.app_ = null;
        
        /* initialize */
        this.initialize_();
    }
    
    C.lang.inherit(RomeHandler, C.caligula.handlers.Handler);
    
    /**
     * Initialize this handler
     * 
     * @method initialize_
     */
    RomeHandler.prototype.initialize_ = function () {
        
        var file = null,
            json = null,
            message = null,
            base = null;
        
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
        
        C.lang.merge(base, this.config_);
        this.config_ = base;
        
        /* Loading the application specific configuration from config.json under
         * current directory
         */
        file = C.natives.path.resolve(C.process.cwd(), 'config.json');
        if (!C.natives.fs.existsSync(file)) {
            this.logger_.warn('Application specified configuration file ' + 
                              file + ' does not exist.');
        } else {
            message = 'Loading application-specific configuration from "' + 
                      file + '"';
            this.logger_.debug(message + ' ...');
            
            try {
                json = C.require(file);
                C.lang.merge(this.config_, json);
            } catch (e) {
                C.error(message + ' failed. Error: ' + e.toString());
                // TODO: throw new customized error
                throw e;
            }
            
            this.logger_.debug(message + ' succeed.');
            this.logger_.debug('Merged config: ' + 
                               C.lang.reflect.inspect(this.config_));
        }
    };
    
    /**
     * Bootstrap the new Condotti context and initiate the HTTP API server
     * 
     * @method bootstrap_
     * @param {Function} callback the callback function to be invoked after the
     *                            HTTP server is stopped, or some error occurs.
     *                            The signature of the callback is 
     *                            'function (error, result) {}'
     */
    RomeHandler.prototype.bootstrap_ = function (callback) {
        var message = null,
            self = this,
            factory = null,
            newC = null;
            
        C.async.waterfall([
            function (next) {
                message = 'Bootstraping new Condotti instance with config ' +
                          C.lang.reflect.inspect(self.config_);
                self.logger_.debug(message + ' ...');
                
                newC = new Condotti(self.config_.condotti);
                newC.use(self.config_.modules, next);
            },
            function (unused, next) {
                var loader = null;
                    
                self.logger_.debug(message + ' succeed.');
                self.logger_.info('Context is switched to new Condotti ' +
                                  'instance');
                
                message = 'Initializing dotti facotry with config ' + 
                          newC.lang.reflect.inspect(self.config_.dotti) + 
                          ', and loading the components';
                newC.debug(message + ' ...');
                
                factory = new newC.di.DottiFactory(self.config_.dotti);
                loader = factory.get('component-loader');
                if (!loader) {
                    newC.warn('Component loader is not specified.');
                    next();
                    return;
                }
                
                loader.loadAll(next);
            },
            function (next) {
                
                newC.debug(message + ' succeed.');
                message = 'Service is running';
                newC.debug(message + ' ...');
                self.app_ = factory.get('app');
                self.app_.run(next);
            }
        ], function (error, result) {
            if (error) {
                newC.debug(message + ' failed. Error: ' +
                           newC.lang.reflect.inspect(error));
                callback(error);
                return;
            }
            
            newC.info('Service is terminated with result ' +
                      newC.lang.reflect.inspect(result));
            callback(null, result);
        });
    };
    
    /**
     * Handle the "start" command
     * 
     * @method start
     * @param {Action} action the "start" action to be handled
     */
    RomeHandler.prototype.start = function (action) {
        this.bootstrap_(function (error, result) {
            if (error) {
                action.error(error);
                return;
            }
            
            action.done(result);
        });
    };

}, '0.0.1', { requires: ['caligula.handlers.base'] });