/**
 * This module contains the filters related with nginx inventory data.
 * 
 * @module caligula.components.configuration.filters.nginx
 */
Condotti.add('caligula.components.configuration.filters.nginx', function (C) {

    /**
     * This NginxPostfilter is a child class of Postfilter, and designed to filter
     * the nginx related data for the node(server) when its configuration is to
     * be generated.
     * 
     * @class NginxPostfilter
     * @constructor
     * @extends Filter
     * @params {Object} config the config object for this filter
     */
    function NginxPostfilter (config) {
        /* inheritance */
        this.super();
        
    }
    
    C.lang.inherit(NginxPostfilter, C.caligula.configuration.filters.Postfilter);
    
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
    NginxPostfilter.prototype.execute = function (action, configuration, 
                                                  callback) {
        var self = this,
            cpuAffinity = '',
            cpuCores = null,
            a = '',
            b = '',
            c = 1;

        if (configuration.context.asset && configuration.context.asset.cpus &&
            configuration.context.asset.cpus.cores) {
                cpuCores = configuration.context.asset.cpus.cores;
                for (var i = 0;i < cpuCores;i++) {                                     
                    a = a + '0';                                                            
                }                                                                           
                for (var j = 0; j < cpuCores;j++) {                                    
                    b = (a + (c << j).toString(2)).slice(j+1);
                    cpuAffinity = cpuAffinity + b + ' ';                                            
                }                  
                if (configuration.context.nginx) {
                    configuration.context.nginx.cpuAffinity = cpuAffinity;
                } else {
                    configuration.context.nginx = {};
                    configuration.context.nginx.cpuAffinity = cpuAffinity;
                }
                self.logger_.debug('Calculate nginx worker_cpu_affinity ' + 
                                   'succeed. Result: ' + 
                                   C.lang.reflect.inspect(cpuAffinity));
                callback();
        } else {
            callback(new Error('Asset data error when calculate nginx ' + 
                           'worker_cpu_affinity.'));
        }
    };
    
    C.namespace('caligula.configuration.filters').NginxPostfilter = NginxPostfilter;

}, '0.0.1', { requires: ['caligula.components.configuration.filters.base'] });
