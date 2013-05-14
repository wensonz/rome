/**
 * This module contains the implementation of the component loader, which is
 * designed to load specified components into the application.
 * 
 * @module caligula.component.loader
 */
Condotti.add('caligula.component.loader', function (C) {

    /**
     * This Loader class is used to load components into the running
     * application.
     * 
     * @class Loader
     * @constructor
     * @param {Object} config the config object for this loader
     */
    function Loader (config) {
        /**
         * The config object for this loader
         * 
         * @property config_
         * @type Object
         * @default {}
         */
        this.config_ = config || {};
        
        /**
         * The logger instance for this loader
         * 
         * @property logger_
         * @type Logger
         */
        this.logger_ = C.logging.getObjectLogger(this);
    }
    
    /**
     * Load all registered components
     * 
     * @method loadAll
     * @param {Function} callback the callback function to be invoked after
     */
    
}, '0.0.1', { requires: [] });