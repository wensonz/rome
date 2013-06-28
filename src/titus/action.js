/**
 * This module contains the implementation of the OrcaAction, which is designed
 * to keep incoming orchestration request and the related info for completing
 * the request
 *
 * @module caligula.components.orca.action
 */
Condotti.add('caligula.components.orca.action', function (C) {
    
    /**
     * This OrcaAction is a child of the abstract base class Action, and is
     * designed to keep the incoming orchestration request and its related info
     * in order to complete it.
     *
     * @class OrcaAction
     * @constructor
     * @extends Action
     * @param {Router} router the router for routing action to another one
     * @param {Object} message the incoming request message
     * @param {OrcaApp} app the orca app serving this action
     */
    function OrcaAction (router, message, app) {
        /* inheritance */
        this.super(router);
        
        /**
         * The incoming request message received
         * 
         * @property message_
         * @type Object
         */
        this.message_ = message;
        
        /**
         * The OrcaApp instance which serves this action
         * 
         * @property app_
         * @type OrcaApp
         */
        this.app_ = app;
    }
    
    C.lang.inherit(OrcaAction, C.caligula.actions.Action);
    
    /**
     * End the current request processing flow, and return the passed-in data to
     * the client. Note that this method is expected to be called when the
     * processing successfully completes by the correct handler, otherwise
     * method "error" should be called instead.
     *
     * @method done
     * @param {Object} data the data to be returned to the client
     * @param {Object} meta the meta data that may affect the output, such as 
     *                      the HTTP status code, etc.
     */
    OrcaAction.prototype.done = function (data, meta) {
        var response = null;
        
        response = {
            id: this.id,
            sender: this.app_.id,
            job: this.job,
            timestamp: Math.floor(Date.now() / 1000),
            result: data
        };
        
        this.dispatch_(response);
    };
    
    /**
     * Dispatch the generated message back to the orchestration server
     *
     * @method dispatch_
     * @param {Object} message the generated message to be dispatched
     */
    OrcaAction.prototype.dispatch_ = function (message) {
        var topic = null,
            content = null,
            logger = C.logging.getStepLogger(this.logger_);
        
        content = JSON.stringify(message);
        logger.start('Dispatching message ' + C.lang.reflect.inspect(message) + 
                     ' to target "' + this.sender + '"');
                       
        topic = this.app_.getTopic(this.sender);
        topic.write(content);
        logger.done();
    };
    
    
    /**
     * The same functionality with method "done", except that it is expected to
     * be called when some error occurs during the request processing.
     *
     * @method error
     * @param {Error} error the error object indicates what happened when this
     *                      error occurred
     * @param {Object} meta the meta data for this error response
     */
    OrcaAction.prototype.error = function (error, meta) {
        var response = null;
        
        response = {
            id: this.id,
            sender: this.app_.id,
            job: this.job,
            timestamp: Math.floor(Date.now() / 1000),
            error: {
                code: error.code || 50000,
                message: error.message
            }
        };
        
        this.dispatch_(response);
    };
    
    C.namespace('caligula.actions').OrcaAction = OrcaAction;
    
}, '0.0.1', { requires: ['caligula.actions.base'] });