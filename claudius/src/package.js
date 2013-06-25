/**
 * This module contains the filter to set the packages to be installed onto the
 * backend servers that belong to the specified group
 * 
 * @module caligula.components.publishing.package
 */
Condotti.add('caligula.components.publishing.package', function (C) {

    /**
     * This PackagePrefilter is a child class of Prefilter, and designed to 
     * update the packages to be installed onto the backend server that trigger
     * this generation from the group the server belongs to.
     * 
     * @class PackagePrefilter
     * @constructor
     * @extends Filter
     */
    function PackagePrefilter () {
        /* inheritance */
        this.super();
    }
    
    C.lang.inherit(PackagePrefilter, C.caligula.configuration.filters.Prefilter);
    
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
    PackagePrefilter.prototype.execute = function (action, configuration, callback) {
        var params = action.data,
            self = this
            logger = C.logging.getStepLogger(this.logger_);
            
        action.data = {
            criteria: { backends: params.node }
        };
        
        logger.start('Querying the group contains the backend ' + params.node);
        
        action.acquire('data.publishing.group.read', function (error, result) {
            var resources = null,
                package = null;
            
            action.data = params;
            
            if (error) {
                logger.error(error);
                callback(error);
                return;
            }
            
            logger.done(result);
            if (0 === result.affected) {
                self.logger_.warn('Publishing group contains the node ' + 
                                  params.node + 
                                  ' as backend can not be found');
                callback();
                return;
            }
            
            package = result.data[0].package;
            
            configuration.resources = configuration.resources || {};
            resources = configuration.resources;
            resources['packages'] = resources['packages'] || {
                type: 'package',
                packages: {}
            };
            
            resources['packages'].packages[package.name] = package.version;
            callback();
        });
    };
    
    C.namespace('caligula.configuration.filters').PackagePrefilter = PackagePrefilter;

}, '0.0.1', { requires: ['caligula.components.configuration.filters.base'] });