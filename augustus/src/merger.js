/**
 * This module contains the default configuration merger implementation of class
 * ConfigurationMerger.
 * 
 * @module caligula.components.configuration.merger
 */
Condotti.add('caligula.components.configuration.merger', function (C) {
    
    // The C++ addon for fast json merging
    // C.lang.merge = C.require('native-object-merge');
    
    /**
     * This ConfigurationMerger class is the default configuration merger, which
     * is designed to merge the configuration data of the roles included 
     * directly or indirectly by a node when generating configurations for it. 
     * With this merger, configuration management api enables the inheritance 
     * and polymophism among the configuration roles, thus provides a flexable, 
     * extensible mechanism to organize the configuration data hierachy.
     * 
     * @class ConfigurationMerger
     * @constructor
     */
    function ConfigurationMerger() {
        /**
         * The logger instance for this merger
         * 
         * @property logger_
         * @type Logger
         */
        this.logger_ = C.logging.getObjectLogger(this);
    }
    
    /**
     * Merge the resources and context of the specified configuration list. The 
     * configurations in the passed-in list are supposed to be in the order, which 
     * reflects the dependency relationships among them. When merging 
     * configuration A and B, whether the item can overwrite the same one in B
     * is determined by the priority of them. The priority of a configuration is
     * the distance between it and the root, the configuration which there is no
     * any other configuration includes. Say there are 3 configurations, A, B 
     * and C. The dependent relations are A -> B, B -> C, then the priority of B
     * is 1, and C is 2. Before merging, priorities of the passed-in 
     * configurations are to be calculated first. During merging, the ones with
     * the same priority are to be merged first with overwritten disabled. After
     * that the intermediate results are merged with overwritten enabled since
     * they represent different priorities. When confliction detected in merging
     * the configuration data in a same priority, an error of type 
     * ConflictionDetectedError is raised.
     * 
     * @method merge
     * @param {Array} configurations the list of configurations to be merged
     * @return {Object} the merged result object
     */
    ConfigurationMerger.prototype.merge = function (configurations) {
        var priorities = {},
            groups = [];
        
        // Calculating the priorities of the configurations
        configurations.forEach(function (configuration) {
            var includes = configuration.includes || [],
                name = configuration.name;
            
            priorities[name] = includes.reduce(function (max, include, index) {
                return Math.max(max, priorities[include] + 1);
            }, 0);
        });
        
        // Sort the priorities
        configurations.forEach(function (configuration) {
            var name = configuration.name,
                priority = priorities[name];
            
            groups[priority] = groups[priority] || [];
            groups[priority].push(configuration);
        });
        
        return groups.reduce(function (merged, group, index) {
            var intermediate = null;
            
            if (!group.length) {
                return merged;
            }
            
            intermediate = group.reduce(function (a, b) {
                C.lang.merge(a.context, b.context, false);
                C.lang.merge(a.resources, b.resources, false);
            }, { context: {}, resources: {} });
            
            C.lang.merge(merged, intermediate);
            
            return merged;
        }, { context: {}, resources: {} });
    };
    
    C.namespace('caligula.configuration').ConfigurationMerger = ConfigurationMerger;

}, '0.0.1', { requires: [] });
