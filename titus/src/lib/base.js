/**
 * This module contains the main logic of Orca.
 * 
 * @module caligula.components.orca.base
 */
Condotti.add('caligula.components.orca.base', function (C) {

    /**
     * This OrcaHandler is designed as the main entrance of the program Orca.
     * 
     * @class OrcaHandler
     * @constructor
     * @extends Handler
     * @param {Object} config the config for this handler
     */
    function OrcaHandler (config) {
        /* inheritance */
        this.super();
        
        /**
         * The config object for this handler
         * 
         * @property config_
         * @type Object
         */
        this.config_ = config;
    }
    
    /**
     * Start orca
     * 
     * @method start
     * @param {Action} action the "start" action to be handled
     */
    OrcaHandler.prototype.start = function (action) {
        // TODO: 0. load config
        //       1. deamonize
        //       2. establish connection
        //       3. authentication
        //       4. handle task
        
        var io = C.require('socket.io-client'),
            socket = null,
            self = this,
            message = null;
        
        message = 'Connecting to Orchestraction API server ' + 
                  C.lang.reflect.inspect(this.config_.server);
        this.logger_.debug(message + ' ...');
        
        socket = io(this.config_.server);
        socket.on('connect', function () {
            
            self.logger_.debug(message + ' succeed.');
            
            socket.on('event', function (data) {
                C.process.stdout.print('exec ' + data);
            });
            
        }).on('error', function (error) {
            self.logger_.debug(message + ' failed. Error: ' +
                               C.lang.reflect.inspect(error));
            action.error(error);
        });
    };

}, '0.0.1', { requires: [] });