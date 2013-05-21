/**
 * This module contains the filters related with asset inventory data.
 * 
 * @module caligula.components.configuration.filters.asset
 */
Condotti.add('caligula.components.configuration.filters.asset', function (C) {

    /**
     * This AssetPrefilter is a child class of Prefilter, and designed to filter
     * the asset related data for the node(server) when its configuration is to
     * be generated.
     * 
     * @class AssetPrefilter
     * @constructor
     * @extends Filter
     * @params {Object} config the config object for this filter
     */
    function AssetPrefilter (config) {
        /* inheritance */
        this.super();
        
    }
    
    C.lang.inherit(AssetPrefilter, C.caligula.configuration.filters.Prefilter);
    
    /**
     * Execute this filter on the passed-in configuration based on the incoming
     * action.
     * 
     * @method execute
     * @param {Action} action the generation action causes this filter to be
     *                        executed
     * @param {Object} configuration the configuration which this filter belongs
     *                               to
     * @param {Function} callback the callback function to be invoked after the
     *                            configuration data has been successfully
     *                            filtered, or some error occurs. The signature
     *                            of this callback is 'function (error) {}'
     */
    AssetPrefilter.prototype.execute = function (action, configuration, callback) {
        var params = action.data,
            self = this,
            message = null;
            
        action.data = {
            criteria: { name: configuration.name }
        };
        message = 'Reading asset inventory for node ' + configuration.name;
        this.logger_.debug(message + ' ...');
        
        action.acquire('asset.read', function (error, result) {
            action.data = params;
            
            if (error) {
                self.logger_.error(message + ' failed. Error: ' + 
                                   C.lang.reflect.inspect(error));
                callback(error);
                return;
            }
            
            self.logger_.debug(message + ' succeed. Result: ' +
                               C.lang.reflect.inspect(result));
            // double check if the result exist
            configuration.context.asset = result.data[0];
            callback();
        });
    };
    
    C.namespace('caligula.configuration.filters').AssetPrefilter = AssetPrefilter;

}, '0.0.1', { requires: ['caligula.components.configuration.filters.base'] });