/**
 * This module contains the implementation of the error types used in the CLI
 * environment, such as ActionHandlerNotFoundError, etc.
 *
 * @module caligula.errors.cli
 */
Condotti.add('caligula.errors.cli', function (C) {
    
    var MAX_EXIT_CODE = 256;
    
    /**
     * This CliError class is the abstract base class of all CLI errors
     * the command line application may thrown. Normally it contains the error 
     * code as the exit code and message to be written onto the error output
     * stream
     *
     * @class CliError
     * @constructor
     * @param {Number} code the error code for this error
     * @param {String} message the error message for this error
     */
    function CliError(code, message) {
        
        /**
         * The error code for this error
         * 
         * @property code
         * @type Number
         * @deafult code
         */
        this.code = code % MAX_EXIT_CODE;
        
        /**
         * The error message for this error
         * 
         * @property message
         * @type String
         * @deafult message
         */
        this.message = message;
        
        /**
         * The name of this error type
         * 
         * @property name
         * @type String
         */
        this.name = C.lang.reflect.getFunctionName(this.constructor);
    }
    
    C.lang.inherit(CliError, Error);
    
    
    C.namespace('caligula.errors').CliError = CliError;
    
    /**
     * This type of error is thrown when the incoming command line request or 
     * the required action can not be handled successfully due to the invalid
     * passed-in parameters.
     *
     * @class InvalidArgumentError
     * @constructor
     * @extends CliError
     */
    function InvalidArgumentError (message) {
        /* inheritance */
        this.super(400, message);
    }
    
    C.lang.inherit(InvalidArgumentError, CliError);
    
    C.namespace('caligula.errors').InvalidArgumentError = InvalidArgumentError;
    
    /**
     * This type of error is thrown when something wrong happens internal the
     * server, such as the connection to the database broken, etc.
     *
     * @class InternalServerError
     * @constructor
     * @extends CliError
     * @param {String} message the message describes this error
     */
    function InternalServerError(message) {
        /* inheritance */
        this.super(500, message);
    }
    
    C.lang.inherit(InternalServerError, CliError);
    
    C.namespace('caligula.errors').InternalServerError = InternalServerError;
    
    /**
     * This type of error is thrown when the action handler can not be found
     * in the routing tree by the router
     *
     * @class ActionHandlerNotFoundError
     * @constructor
     * @extends CliError
     * @param {String} message the message describes this error
     */
    function ActionHandlerNotFoundError (message) {
        /* inheritance */
        this.super(404, message);
    }
    
    C.lang.inherit(ActionHandlerNotFoundError, CliError);
    
    C.namespace('caligula.errors').ActionHandlerNotFoundError = 
        ActionHandlerNotFoundError;
    
    
    /**
     * This type of error is thrown when the action handler is found not be
     * a callable, because it's not a function, nor an object with a member
     * function 'call'.
     *
     * @class ActionHandlerNotCallableError
     * @constructor
     * @extends CliError
     * @param {String} message the message describes this error
     */
    function ActionHandlerNotCallableError (message) {
        /* inheritance */
        this.super(406, message);
    }
    
    C.lang.inherit(ActionHandlerNotCallableError, CliError);
    
    C.namespace('caligula.errors').ActionHandlerNotCallableError = 
        ActionHandlerNotCallableError;
    
}, '0.0.1', { requires: [] });
