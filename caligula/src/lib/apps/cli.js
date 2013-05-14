/**
 * This module contains the implementaion of the CLI app.
 *
 * @module caligula.apps.cli
 */
Condotti.add('caligula.apps.cli', function (C) {
    //
    /**
     * This CliApp class implements the server-side CLI app
     *
     * @class CliApp
     * @constructor
     * @param {Object} config the config object for this app
     * @param {Contextualizer} contextualizer the contextualizer used to 
     *                                        contextualize the incoming CLI
     *                                        request to CliAction instance
     * @param {Router} router the router for routing the action context instance
     *                        to its correct handler and invoke the handler to
     *                        complete the processing of the request
     */
    function CliApp (config, contextualizer, router) {
        /**
         * The config object for this app
         *
         * @property config_
         * @type Object
         * @default {}
         */
        this.config_ = config || {}; 

        /**
         * The contextualizer to contextualize the incoming CLI request to
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
    }

    /**
     * Run this app instance
     *
     * @method run
     */
    CliApp.prototype.run = function () {
        var action = null,
            self = this;
        
        this.logger_.debug('Contextualizing the incoming request: ' +
                           C.process.argv.toString());
        
        action = new C.caligula.actions.CliAction(
            this.router_, C.process.stdout, C.process.stderr
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
    
    C.namespace('caligula.apps').CliApp = CliApp;

}, '0.0.1', { requires: [] });
