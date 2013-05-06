/**
 * This module contains the definition of the abstract base class Contextualizer, 
 * which is designed to be the ancestor of all concrete contextualizer for 
 * different incoming requests, such as HttpContextualizer, etc.
 *
 * @module caligula.contextualizers.base
 */
Condotti.add('caligula.contextualizers.base', function (C) {
    
    /**
     * This Contextualizer class is the abstract base class of all concrete
     * contextualizers, which process different type of incoming request, such
     * as HttpContextualizer for HTTP request, etc. The contextualizers are
     * expected to process the incoming request correctly and inject the
     * required data into the passed-in action instance, in order to complete
     * the furthering steps, such as the data property that contains the input
     * parameters for ROME API, is converted from the JSON payload of the HTTP
     * request.
     *
     * @class Contextualizer
     * @constructor
     */
    function Contextualizer () {
        /**
         * The logger instance
         *
         * @property logger_
         * @type Logger
         */
        this.logger_ = C.logging.getObjectLogger(this);
    }
    
    /**
     * Contextualize the incoming request and related data into the passed-in
     * action object appropriately to complete the further processing.
     *
     * @method contextualize
     * @param {Action} action the action object to be contextualized into
     * @param {Function} callback the callback function to be invoked after the
     *                            action context has been successfully
     *                            contextualized, or some error occurs. The 
     *                            signature of the callback is 
     *                            'function (error) {}'
     */
    Contextualizer.prototype.contextualize = function (action, callback) {
        callback(new C.errors.NotImplementedError('This contextualize method' +
                                                  ' is not implemented in ' +
                                                  'this class, and is ' +
                                                  'expected to be overwritten' +
                                                  ' in its child classes.'));
    };
    
    /**
     * Decontextualize the action object to a plain object which is to be used
     * as the params of the "request" module to create HTTP request to remote
     * HTTP API server.
     *
     * @method decontextualize
     * @param {Action} action the action object to be decontextualized
     * @param {Function} callback the callback function to be invoked when the
     *                            action object has been successfully 
     *                            decontextualized, or some error occurs. The
     *                            signature of the callback is
     *                            'function (error, data) {}'
     */
    Contextualizer.prototype.decontextualize = function (action, callback) {
        callback(new C.errors.NotImplementedError('This decontextualize method' +
                                                  ' is not implemented in ' +
                                                  'this class, and is ' +
                                                  'expected to be overwritten' +
                                                  ' in its child classes.'));
    };
    
    C.namespace('caligula.contextualizers').Contextualizer = Contextualizer;
    
}, '0.0.1', { requires: [] });