/**
 * This module contains the implementation of the HttpHandler class, which is
 * designed to
 *
 * @module caligula.handlers.http
 */
Condotti.add('caligula.handlers.http', function (C) {
    
    /**
     * description here
     *
     * @class HttpHandler
     * @constructor
     * @param {Object} config the config object for this HTTP handler
     * @param {HttpContextualizer} contextualizer the contextualizer used to
     *                                            decontextualize the action
     *                                            object to the HTTP request to
     *                                            be sent to the remote HTTP
     *                                            API server to complete the
     *                                            required action
     */
    function HttpHandler (config, contextualizer) {
        /* inheritance */
        this.super();
        
        /**
         * The config object for this HTTP handler
         * 
         * @property config_
         * @type Object
         */
        this.config_ = config;
        
        /**
         * The HTTP contextualizer used to decontextualize the action object
         * into the HTTP request that is to be sent when this handler is called 
         * to complete the routed action.
         * 
         * @property contextualizer_
         * @type HttpContextualizer
         */
        this.contextualizer_ = contextualizer;
    }
    
    C.lang.inherit(HttpHandler, C.caligula.handlers.Handler);
    
    /**
     * Handle the required action via sending a HTTP request to the configured
     * remote HTTP server.
     *
     * @method handle
     * @param {Action} action the action to be handled
     */
    HttpHandler.prototype.handle = function (action) {
        var request = C.require('request'),
            self = this;
        
        this.contextualizer_.decontextualize(action, function (error, data) {
            // TODO: verify the baseUrl
            data.url = self.config_.baseUrl + data.url;
            // Other modifications
            
            request(data, function (error, response, body) {
                if (error) {
                    self.logger_.error('Sending remote action ' + action.name + 
                                       ' to url ' + data.url + 
                                       ' failed. Error: ' + 
                                       C.lang.reflect.inspect(error));
                
                    action.error(new C.caligula.errors.InternalServerError());
                    return;
                }
                // TODO: check if body is a parsed object
                try {
                    body = JSON.parse(body);
                } catch (e) {
                    self.logger_.error('Malformed JSON response received from' +
                                       ' the remote HTTP action handler ' +
                                       data.url + ' for action ' + action.name +
                                       '. JSON: ' + body);
                    action.error(new C.caligula.errors.InternalServerError());
                    return;
                }
                
                if (body.error) {
                    self.logger_.error('Executing remote action ' + 
                                       action.name + 
                                       ' failed. Code: ' + body.error.code + 
                                       ', message: ' + body.error.message);
                                   
                    action.error(new C.caligula.errors.HttpError(
                        response.statusCode, 
                        body.error.code, 
                        body.error.message
                    ));
                    return;
                }
                
                action.done(body.result);
            });
        });
    };
    
    /**
     * This method is used by the router. When it ends up the searching for the
     * correct handler down the routing tree with an object, it looks up a 
     * method named 'call', if the method exists, the router calls it to handle
     * the required action, otherwise no handler can be found to handle the 
     * action.
     *
     * @method call
     * @param {Action} action the action to be handled
     */
    HttpHandler.prototype.call = function (action) {
        this.handle(action);
    };
    
    /**
     * The 'default' handler to handle the action when the routing tree travel
     * can not complete at some point.
     *
     * @method default
     * @param {Action} action the action to be handled
     */
    HttpHandler.prototype.default = function (action) {
        this.handle(action);
    };
    
    C.namespace('caligula.handlers').HttpHandler = HttpHandler;
    
    
}, '0.0.1', { requires: ['caligula.errors.http', 'caligula.handlers.base'] });