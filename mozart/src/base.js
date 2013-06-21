/**
 * This module contains the implementation of the orchestration APIs.
 *
 * @module caligula.components.orchestration.base
 */
Condotti.add('caligula.components.orchestration.base', function (C) {
    
    /**
     * This OrchestrationHandler is a child class of Handler, and designed to 
     * provide orchestration functionalities via HTTP API
     *
     * @class OrchestrationHandler
     * @constructor
     * @extends Handler
     * @param {Object} config the config object for this handler
     */
    function OrchestrationHandler (config) {
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
    
    C.lang.inherit(OrchestrationHandler, C.caligula.handlers.Handler);
    
    
    /**
     * Read the orchestration job objects satisfied the criteria
     *
     * @method read
     * @param {Action} action the querying action to be handled
     */
    OrchestrationHandler.prototype.read = function (action) {
        action.acquire('data.orchestration.read', function (error, result) {
            if (error) {
                action.error(error);
                return;
            }
            action.done(result);
        });
    };
    
    C.namespace('caligula.handlers').OrchestrationHandler = OrchestrationHandler;
    
}, '0.0.1', { requires: ['caligula.handlers.base'] });
