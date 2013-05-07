/**
 * This module defines the abstract base class Handler for all concrete ones. A
 * handler is supposed to be used to handle a concrete type of required action,
 * such as the HttpHandler is designed to handle the remote action from a HTTP 
 * server, etc. The handler instance may expose multiple methods to handle
 * different actions belong to the same category, for example, a configuration 
 * handler may expose 'create', 'delete', 'read' to handle the creation, 
 * deletion and query actions of the configuration data. If the handler found to
 * handle a required action is an object, member method 'call' is to be invoked
 * if it exists and is a function.
 *
 * @module caligula.handlers.base
 */
Condotti.add('caligula.handlers.base', function (C) {
    
    /**
     * This Handler class is designed to be the abstract base class of all 
     * concrete ones. A handler is supposed to be used to handle a concrete type 
     * of required action, such as the HttpHandler is designed to handle the 
     * remote action from a HTTP server, etc. The handler instance may expose 
     * multiple methods to handle different actions belong to the same category, 
     * for example, a configuration handler may expose 'create', 'delete', 
     * 'read' to handle the creation, deletion and query actions on the 
     * configuration data. If the handler found to handle a required action is 
     * an object, member method 'call' is to be invoked if it exists and is a 
     * function. If the handler for a required action can not be found, and 
     * the nearest handler is to be used if that handler provides a member
     * method named 'default', and this 'default' method is called to handle
     * that action.
     *
     * @class Handler
     * @constructor
     */
    function Handler () {
        /**
         * The logger instance for this handler
         *
         * @property logger_
         * @type Logger
         */
        this.logger_ = C.logging.getObjectLogger(this);
    }
    
    /**
     * Wrap the specified method with the provided validators in order to
     * separate the validation with the handling of the request.
     * 
     * @method validate
     * @static
     * @param {Function} handler the handler function which need the validations
     *                           on its params when called
     * @param {Validator} validator the object validator used to validate 
     *                              the passed-in action object
     * @return {Function} the wrapped function
     */
    Handler.validate = function (handler, validator) {
        return function (action) {
            try {
                validator.validate(action);
            } catch (e) {
                this.logger_.error('Validating action ' + 
                                   C.lang.reflect.inspect(action) + 
                                   ' failed. Error: ' + e.message);
                action.error(
                    new C.caligula.errors.InvalidArgumentError(e.message)
                );
                return;
            }
            
            handler.call(this, action);
        };
    };
    
    C.namespace('caligula.handlers').Handler = Handler;
    
}, '0.0.1', { requires: [] });