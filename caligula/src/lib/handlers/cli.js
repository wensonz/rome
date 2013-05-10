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
    }
    
    C.lang.inherit(ServiceHandler, C.caligula.handlers.Handler);
    
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
                          C.lang.reflect.inspect(this.config_);
                self.logger_.debug(message + ' ...');
                
                C.startup.bootstrap(this.config_, next);
            },
            function (newC, next) {
                self.logger_.debug(message + ' succeed.');
                message = 'Starting service';
                self.logger_.debug(message + ' ...');
                newC.startup.start(self.config_, next);
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