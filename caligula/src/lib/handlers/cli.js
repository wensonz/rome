/**
 * This module contains the implementations of the handlers designed for CLI
 * environment, such as the service handler that provides "start", "stop", etc.
 * 
 * @module caligula.handlers.cli
 */
Condotti.add('caligula.handlers.cli', function (C) {

    /**
     * This ServiceHandler is designed to provide "start", "stop" commands to
     * a CLI application.
     * 
     * @class ServiceHandler
     * @constructor
     * @extends Handler
     * @param {Object} config the config object for the service to be started
     */
    function ServiceHandler (config) {
        /* inheritance */
        this.super();
        
        /**
         * The config object for the service to be started
         * 
         * @property config_
         * @type Object
         */
        this.config_ = config;
        
        /* initialize */
        this.initialize_();
    }
    
    C.lang.inherit(ServiceHandler, C.caligula.handlers.Handler);
    
    /**
     * Initialize this handler
     * 
     * @method initialize_
     */
    ServiceHandler.prototype.initialize_ = function () {
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
     * Handle the "start" command
     * 
     * @method start
     * @param {Action} action the "start" action to be handled
     */
    ServiceHandler.prototype.start = function (action) {
        // action.done('start command is called');
        // TODO: add daemon support
        //       add cluster support
        
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
                var app = null;
                
                newC.debug(message + ' succeed.');
                message = 'Service is running';
                newC.debug(message + ' ...');
                app = factory.get('app');
                app.run(next);
            }
        ], function (error, result) {
            if (error) {
                newC.debug(message + ' failed. Error: ' +
                           newC.lang.reflect.inspect(error));
                action.error(error);
                return;
            }
            
            newC.info('Service is terminated with result ' +
                      newC.lang.reflect.inspect(result));
            action.done(result);
        });
    };
    
    C.namespace('caligula.handlers').ServiceHandler = ServiceHandler;

}, '0.0.1', { requires: ['caligula.handlers.base', 'caligula.startup.simple'] });