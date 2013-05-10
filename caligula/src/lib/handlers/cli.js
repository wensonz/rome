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
            message = null;
            
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
            self = this;
            
        C.async.waterfall([
            function (next) {
                message = 'Bootstraping new Condotti instance with config ' +
                          C.lang.reflect.inspect(self.config_);
                self.logger_.debug(message + ' ...');
                
                C.caligula.startup.bootstrap(self.config_, next);
            },
            function (newC, next) {
                self.logger_.debug(message + ' succeed.');
                message = 'Starting service';
                self.logger_.debug(message + ' ...');
                newC.caligula.startup.start(self.config_, next);
            }
        ], function (error, result) {
            if (error) {
                self.logger_.debug(message + ' failed. Error: ' +
                                   C.lang.reflect.inspect(error));
                action.error(error);
                return;
            }
            
            self.logger_.info('Service is terminated.');
            action.done(result);
        });
    };
    
    C.namespace('caligula.handlers').ServiceHandler = ServiceHandler;

}, '0.0.1', { requires: ['caligula.handlers.base', 'caligula.startup.simple'] });