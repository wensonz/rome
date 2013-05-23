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
    
    /**********************************************************************
     *                                                                    *
     *                       STANDARD HTTP ERRORS                         *
     *                                                                    *
     **********************************************************************/
    
    /**
     * Bad request.
     *
     * @class BadRequestError
     * @constructor
     * @extends HttpError
     */
    function BadRequestError (message) {
        /* inheritance */
        this.super(400, 400, message);
    }
    
    C.lang.inherit(BadRequestError, HttpError);
    
    C.namespace('caligula.errors').BadRequestError = BadRequestError;
    
    /**
     * This type of error is thrown when the incoming HTTP request or the 
     * required action can not be handled successfully due to the invalid
     * passed-in parameters.
     *
     * @class InvalidArgumentError
     * @constructor
     * @extends BadRequestError
     */
    function InvalidArgumentError (message) {
        /* inheritance */
        this.super(message);
    }
    
    C.lang.inherit(InvalidArgumentError, BadRequestError);
    
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
     * Not found
     *
     * @class NotFoundError
     * @constructor
     * @extends HttpError
     * @param {String} message the message describes this error
     */
    function NotFoundError (message) {
        /* inheritance */
        this.super(404, 404, message);
    }
    
    C.lang.inherit(NotFoundError, HttpError);
    
    C.namespace('caligula.errors').NotFoundError = NotFoundError;
    
    /**
     * This type of error is thrown when the action handler can not be found
     * in the routing tree by the router
     *
     * @class ActionHandlerNotFoundError
     * @constructor
     * @extends NotFoundError
     * @param {String} message the message describes this error
     */
    function ActionHandlerNotFoundError (message) {
        /* inheritance */
        this.super(message);
    }
    
    C.lang.inherit(ActionHandlerNotFoundError, NotFoundError);
    
    C.namespace('caligula.errors').ActionHandlerNotFoundError = 
        ActionHandlerNotFoundError;
    
    /**
     * Not acceptable
     *
     * @class NotAcceptableError
     * @constructor
     * @extends HttpError
     * @param {String} message the message describes this error
     */
    function NotAcceptableError (message) {
        /* inheritance */
        this.super(406, 406, message);
    }
    
    C.lang.inherit(NotAcceptableError, HttpError);
    
    C.namespace('caligula.errors').NotAcceptableError = NotAcceptableError;
    
    /**
     * This type of error is thrown when the action handler is found not be
     * a callable, because it's not a function, nor an object with a member
     * function 'call'.
     *
     * @class ActionHandlerNotCallableError
     * @constructor
     * @extends NotAcceptableError
     * @param {String} message the message describes this error
     */
    function ActionHandlerNotCallableError (message) {
        /* inheritance */
        this.super(message);
    }
    
    C.lang.inherit(ActionHandlerNotCallableError, NotAcceptableError);
    
    C.namespace('caligula.errors').ActionHandlerNotCallableError = 
        ActionHandlerNotCallableError;
    
    /**
     * Conflict
     *
     * @class ConflictError
     * @constructor
     * @extends HttpError
     * @param {String} message the message describes this error
     */
    function ConflictError (message) {
        /* inheritance */
        this.super(409, 409, message);
    }
    
    C.lang.inherit(ConflictError, HttpError);
    
    C.namespace('caligula.errors').ConflictError = ConflictError;
    
    /**
     * Gone
     *
     * @class GoneError
     * @constructor
     * @extends HttpError
     * @param {String} message the message describes this error
     */
    function GoneError (message) {
        /* inheritance */
        this.super(410, 410, message);
    }
    
    C.lang.inherit(GoneError, HttpError);
    
    C.namespace('caligula.errors').GoneError = GoneError;
    
}, '0.0.1', { requires: [] });
