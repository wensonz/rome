/**
 * This module contains the implementation of the HttpContextualizer class, 
 * which is the child class of its abstract base Contextualizer, and is used to 
 * contextualize the incoming HTTP request into an HttpAction instance.
 *
 * @module caligula.contextualizers.http
 */
Condotti.add('caligula.contextualizers.http', function (C) {
    
    /**
     * This HttpContextualizer class is the child class of its abstract base
     * Contextualizer, and is designed to process the incoming HTTP
     * request, and add the contextualized data into the passed-in HttpAction 
     * object based on the request in order to complete the following processing.
     *
     * @class HttpContextualizer
     * @constructor
     */
    function HttpContextualizer () {
        /* inheritance */
        this.super();
    }
    
    C.lang.inherit(HttpContextualizer, 
                   C.caligula.contextualizers.Contextualizer);
    
    /**
     * Contextualize the incoming HTTP request, the generated HTTP response and
     * other related data into the passed-in action object appropiately to 
     * complete the further processing.
     *
     * @method contextualize
     * @param {HttpAction} action the action object to be contextualized into
     * @param {Function} callback the callback function to be invoked after the
     *                            action context has been successfully
     *                            contextualized, or some error occurs. The 
     *                            signature of the callback is 
     *                            'function (error) {}'
     */
    HttpContextualizer.prototype.contextualize = function (action, callback) {
        var name = null,
            url = null,
            message = null;
        
        try {
            /* generate the action name */
            url = C.natives.url.parse(action.request.url);
            // url.pathname is supposed to start with '/'
            name = url.pathname.replace(/^\/|\/$/g, '').split('/').join('.');
        } catch (e) {
            message = 'Parsing request url: ' + action.request.url + 
                      ' and generating action name failed. Error: ' +
                      C.lang.reflect.inspect(e);
            this.logger_.debug(message);
            callback(new C.caligula.errors.InvalidArgumentError(message));
            return;
        }
        
        action.name = name;
        action.data = action.request.body;
        action.files = action.request.files;
        action.url = url;
        action.params = url.query; // TODO: add auth info
        
        callback();
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
    HttpContextualizer.prototype.decontextualize = function (action, callback) {
        var data = {};
        
        data.url = '/' + action.name.split('.').join('/') + '/';
        data.json = action.data; // used for "request"
        // TODO: add query string and headers
        callback(null, data);
    };
    
    
    C.namespace('caligula.contextualizers').HttpContextualizer = HttpContextualizer;
    
}, '0.0.1', { requires: ['caligula.contextualizers.base', 
                         'caligula.errors.http'] });