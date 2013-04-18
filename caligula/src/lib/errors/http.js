/**
 * This module contains the implementation of the error types used in the HTTP
 * environment, such as ActionHandlerNotFoundError, etc.
 *
 * @module caligula.errors.http
 */
Condotti.add('caligula.errors.http', function (C) {
    
    /**
     * This HttpError class is the abstract base class of all HTTP errors
     * the HTTP API server may thrown. Normally it contains the HTTP status
     * code for the HTTP response, and the error code and message to construct
     * the response payload.
     *
     * @class HttpError
     * @constructor
     * @param {Number} status the status code of the HTTP response
     * @param {Number} code the error code for this error
     * @param {String} message the error message for this error
     */
    function HttpError(status, code, message) {
        /**
         * The status code for the HTTP response
         * 
         * @property status
         * @type Number
         * @deafult status
         */
        this.status = status;
        
        /**
         * The error code for this error
         * 
         * @property code
         * @type Number
         * @deafult code
         */
        this.code = code;
        
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
    
    C.lang.inherit(HttpError, Error);
    
    
    C.namespace('caligula.errors').HttpError = HttpError;
    
    /**
     * This type of error is thrown when the incoming HTTP request or the 
     * required action can not be handled successfully due to the invalid
     * passed-in parameters.
     *
     * @class InvalidArgumentError
     * @constructor
     * @extends HttpError
     */
    function InvalidArgumentError (message) {
        /* inheritance */
        this.super(400, 400, message);
    }
    
    C.lang.inherit(InvalidArgumentError, HttpError);
    
    C.namespace('caligula.errors').InvalidArgumentError = InvalidArgumentError;
    
    /**
     * This type of error is thrown when something wrong happens internal the
     * server, such as the connection to the database broken, etc.
     *
     * @class InternalServerError
     * @constructor
     * @extends HttpError
     * @param {String} message the message describes this error
     */
    function InternalServerError(message) {
        /* inheritance */
        this.super(500, 500, message);
    }
    
    C.lang.inherit(InternalServerError, HttpError);
    
    C.namespace('caligula.errors').InternalServerError = InternalServerError;
    
    /**
     * This type of error is thrown when the action handler can not be found
     * in the routing tree by the router
     *
     * @class ActionHandlerNotFoundError
     * @constructor
     * @extends C.errors.HttpError
     * @param {Action} action the action to be routed
     * @param {String} segment the segment of the action name that stops the 
     *                         routing tree travel
     */
    function ActionHandlerNotFoundError (action, segment) {
        /* inheritance */
        this.super(404, 404, 'API ' + action.url.pathname + 
                             ' can not be found.');
        
        this.name = 'ActionHandlerNotFoundError';
        this.action = action;
        this.segment = segment;
    }
    
    C.lang.inherit(ActionHandlerNotFoundError, HttpError);
    
    C.namespace('caligula.errors').ActionHandlerNotFoundError = 
        ActionHandlerNotFoundError;
    
    /**
     * This type of errors are thrown when a batch updates or removes are
     * required, but only some of them succeed.
     *
     * @class PartialFailedError
     * @constructor
     * @extends HttpError
     * @param {Object} failures the information about the failures, keys of
     *                          which are the identifiers, and the values are
     *                          the corresponding error messages
     */
    function PartialFailedError(failures) {
        /* inheritance */
        this.super(500, 515, 'Partial of the required operations failed. ' +
                             'Failures: ' + JSON.stringify(failures));

        this.name = 'PartialFailedError';
        this.failures = failures;
    }

    C.lang.inherit(PartialFailedError, HttpError);
    C.namespace('caligula.errors').PartialFailedError = PartialFailedError;
    
}, '0.0.1', { requires: [] });
