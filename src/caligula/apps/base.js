/**
 * This module contains the definition of the abstract base class App, which is
 * designed to define the basic behaviours an app is supposed to have
 *
 * @module caligula.apps.base
 */
Condotti.add('caligula.apps.base', function (C) {
    
    /**
     * This App class is the abstract base of all concrete applications, and
     * defines the basic behaviours an app is supposed to have
     *
     * @class App
     * @constructor
     * @extends 
     * @param {Object} config the config for this app
     * @param {Contextualizer} contextualizer the contextualizer used to 
     *                                        contextualize the incoming
     *                                        request to an Action instance
     * @param {Router} router the router for routing the action context instance
     *                        to its correct handler and invoke the handler to
     *                        complete the processing of the request
     */
    function App (config, contextualizer, router) {
        /**
         * The config object for this app
         *
         * @property config_
         * @type Object
         */
        this.config_ = config || {};
        
        /**
         * The logger instance for this app
         *
         * @property logger_
         * @type Logger
         */
        this.logger_ = C.logging.getObjectLogger(this);
        
        /**
         * The contextualizer to contextualize the incoming request to
         * Action instance for the further processing.
         *
         * @property contextualizer_
         * @type Contextualizer
         */
        this.contextualizer_ = contextualizer;

        /**
         * The router used to route the contextualized action to correct handler
         *
         * @property router_
         * @type Router
         */
        this.router_ = router;
    }
    
    /**
     * Run this app
     *
     * @method run
     * @param {Function} callback the callback function to be invoked after the
     *                            app has exited successfully, or some error
     *                            occurs. The signature of the callback is
     *                            "function (error) {}"
     */
    App.prototype.run = function (callback) {
        callback(new C.errors.NotImplementedError('This run method is not ' +
                                                  'implemented in this class,' +
                                                  ' and is expected to be ' +
                                                  'overwritten in child ' +
                                                  'classes.'));
    };
    
    C.namespace('caligula.apps').App = App;
    
}, '0.0.1', { requires: [] });