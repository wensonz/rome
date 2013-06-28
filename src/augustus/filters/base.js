/**
 * This module contains the definitions of the pre-filter and post-filter used
 * to filter the configuration data before and after merging.
 *
 * @module caligula.components.configuration.filters.base
 */
Condotti.add('caligula.components.configuration.filters.base', function (C) {
    
    /**
     * This PreFilter class defines the behaviours a pre-filter is expected to
     * have which is mostly used to compose the configuration data from other
     * sources before merging.
     * 
     * @class Prefilter
     * @constructor
     */
    function Prefilter () {
        /**
         * The logger instance for this filter
         * 
         * @property logger_
         * @type Logger
         */
        this.logger_ = C.logging.getObjectLogger(this);
    }
    
    /**
     * Execute this filter on the passed-in configuration data based on the
     * incoming action.
     * 
     * @method execute
     * @param {Action} action the incoming action causes this filter to be
     *                        executed
     * @param {Object} configuration the configuration object which requires
     *                               this filter to be executed on it
     * @param {Object} configurations the configuration collection
     * @param {Function} callback the callback function to be invoked after the
     *                            configuration data has been successfully
     *                            filtered, or some error occurs. The signature
     *                            of this callback is 'function (error) {}'
     */
    Prefilter.prototype.execute = function (action, configuration, 
                                            configurations, callback) {
        callback(new C.errors.NotImplementedError('This execute method is not' +
                                                  ' implemented in this class' +
                                                  ', and is expected to be ' +
                                                  'overwritten in child classes.'));
    };
    
    C.namespace('caligula.configuration.filters').Prefilter = Prefilter;
    
    /**
     * This PostFilter class defines the behaviours a post-filter is expected to
     * have which is mostly used to compose the configuration data based on
     * the merged configuration data.
     * 
     * @class Postfilter
     * @constructor
     */
    function Postfilter () {
        /**
         * The logger instance for this filter
         * 
         * @property logger_
         * @type Logger
         */
        this.logger_ = C.logging.getObjectLogger(this);
    }
    
    /**
     * Execute this filter on the merged configuration data based on the
     * incoming action.
     * 
     * @method execute
     * @param {Action} action the incoming action causes this filter to be
     *                        executed
     * @param {Object} data the merged configuration data
     * @param {Array} configurations the array of configurations related with
     *                               this generation
     * @param {Function} callback the callback function to be invoked after the
     *                            configuration data has been successfully
     *                            filtered, or some error occurs. The signature
     *                            of this callback is 'function (error) {}'
     */
    Postfilter.prototype.execute = function (action, configuration, callback) {
        callback(new C.errors.NotImplementedError('This execute method is not' +
                                                  ' implemented in this class' +
                                                  ', and is expected to be ' +
                                                  'overwritten in child classes.'));
    };
    
    C.namespace('caligula.configuration.filters').Postfilter = Postfilter;

}, '0.0.1', { requires: [] });