/**
 * This module contains the implementaion of the web app based on the famous
 * node.js "connect" framework and its middlewares.
 *
 * @module caligula.apps.connect
 */
Condotti.add('caligula.apps.connect', function (C) {
    //
    /**
     * This ConnectApp class implements the server-side web app based on the
     * "connect" framework and its middlewares in node.js
     *
     * @class ConnectApp
     * @constructor
     * @param {Object} config the config object for this app, such as the
     *                        listening port, etc.
     * @param {Contextualizer} contextualizer the contextualizer used to 
     *                                        contextualize the incoming HTTP
     *                                        request to HttpAction instance
     * @param {Router} router the router for routing the action context instance
     *                        to its correct handler and invoke the handler to
     *                        complete the processing of the request
     */
    function ConnectApp (config, contextualizer, router) {
        /**
         * The config object for this app
         *
         * @property config_
         * @type Object
         * @default {}
         */
        this.config_ = config || {}; // TODO: add default port and address

        /**
         * The contextualizer to contextualize the incoming HTTP request to
         * Action instance for the further processing.
         *
         * @property contextualizer_
         * @type Contextualizer
         */
        this.contextualizer_ = contextualizer;

        /**
         * The router used to route the HTTP request to correct handler
         *
         * @property router_
         * @type Router
         */
        this.router_ = router;

        /**
         * The logger instance for this app
         * 
         * @property logger_
         * @type Logger
         */
        this.logger_ = C.logging.getObjectLogger(this);

        /**
         * The port number this "connect" app is to listen on
         *
         * @property port_
         * @type Number
         * @default 80
         */
        this.port_ = this.config_.port || 80;

        /**
         * The server address this "connect" app is to listen on
         *
         * @property address_
         * @type String
         * @default undefined
         */
        this.address_ = this.config_.address;

        /**
         * The internal "connect" app instance created via "connect()"
         *
         * @property app_
         * @type Object
         * @default null
         */
        this.app_ = null;

        /**
         * Whether the server is running
         *
         * @property running_
         * @type Boolean
         * @default false
         */
        this.running_ = false;
    }

    /**
     * Run this app instance
     *
     * @method run
     */
    ConnectApp.prototype.run = function () {
        var connect = C.require('connect'),
            middlewares = this.config_.middlewares || [],
            fn = null,
            self = this;

        // TODO: check if the app is already running

        this.app_ = connect();
        
        this.logger_.debug('Loading middleware from config ' + 
                           C.lang.reflect.inspect(middlewares));
        
        middlewares.forEach(function (middleware) {
            var name = middleware.name,
                config = middleware.config;

            if (name.search(/^connect\./i) >= 0) { // native middleware 
                                                   // provides by "connect"
                self.logger_.debug('Connect builtin middleware ' + 
                                   name.substring(8) + 
                                   ' is to be used with config ' +
                                   C.lang.reflect.inspect(config));
                fn = connect[name.substring(8)];
                // TODO: verify if fn exists and is a function
                //       if not a function, such as connect.router, then use it
                //       directly, but "router" is a also function
                self.app_.use(fn.apply(connect, config));
                return;
            }
            //
            self.logger_.debug('Non-builtin middleware ' + name + 
                               ' is to be used with config ' + 
                               C.lang.reflect.inspect(config));
            fn = C.namespace('caligula.middleware.connect')[name];
            // TODO: verify if fn exists and is a function
            self.app_.use(fn.apply(null, config));
        });

        this.app_.use(this.onRequest_.bind(this));
        
        // TODO: check if listen failed
        this.app_.listen(this.port_, this.address_);
        this.logger_.info('Connect app is running on ' + this.address_ +
                          ':' + this.port_ + ' ...');
    };
    
    /**
     * Handle the incoming HTTP request
     *
     * @method onRequest_
     * @param {HttpRequest} request the incoming HTTP request
     * @param {HttpResponse} response the generated HTTP response to be sent
     *                                back to the client
     */
    ConnectApp.prototype.onRequest_ = function (request, response) {
        var self = this,
            action = null;
        
        this.logger_.debug('Contextualizing the incoming request with url: ' +
                           request.url + ', data: ' + request.data);
        
        action = new C.caligula.actions.HttpAction(
            this.router_, request, response
        );
        
        this.contextualizer_.contextualize(action, function (error) {
            if (error) {
                action.error(error);
                return;
            }
            
            self.logger_.debug('Action ' + action.name + 
                               ' is contextualized successfully. Action: ' +
                               C.lang.reflect.inspect(action));
                               
            self.logger_.debug('Routing the contextualized action ...');
            self.router_.route(action);
        });
    };
    
    
    C.namespace('caligula.apps').ConnectApp = ConnectApp;

}, '0.0.1', { requires: [] });
