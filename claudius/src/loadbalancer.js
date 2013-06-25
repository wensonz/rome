/**
 * This module contains the filter to complete the context data required by
 * the template to generate the config files for the load balancer which
 * triggers this generation.
 * 
 * @module caligula.components.publishing.loadbalancer
 */
Condotti.add('caligula.components.publishing.loadbalancer', function (C) {

    /**
     * This LoadBalancerPrefilter is a child class of Prefilter, and designed to 
     * complete the context data required by
     * the template to generate the config files for the load balancer which
     * triggers this generation.
     * 
     * @class LoadBalancerPrefilter
     * @constructor
     * @extends Filter
     * @param {Object} config the config object for this filter
     */
    function LoadBalancerPrefilter (config) {
        /* inheritance */
        this.super();
        
        /**
         * The root directory for the uid file/ip range file to be placed
         * 
         * @property root_
         * @type String
         */
        this.root_ = config.root || '/usr/local/sinasrv2/etc/nginx/strategies';
    }
    
    C.lang.inherit(LoadBalancerPrefilter, C.caligula.configuration.filters.Prefilter);
    
    /**
     * Execute this filter on the passed-in configuration based on the incoming
     * action.
     * 
     * @method execute
     * @param {Action} action the generation action causes this filter to be
     *                        executed
     * @param {Object} configuration the configuration which this filter belongs
     *                               to
     * @param {Object} configurations the configuration collection
     * @param {Function} callback the callback function to be invoked after the
     *                            configuration data has been successfully
     *                            filtered, or some error occurs. The signature
     *                            of this callback is 'function (error) {}'
     */
    LoadBalancerPrefilter.prototype.execute = function (action, configuration, 
                                                        configurations, callback) {
        var params = action.data,
            self = this
            logger = C.logging.getStepLogger(this.logger_),
            isp = null,
            node = null,
            error = null;
            
        // configuration.context.asset.includes
        logger.start('Searching for the ISP this load balancer belongs to');
        node = configurations[params.node];
        // node MUST exist
        node.includes.some(function (include) {
            if (include.search(/isp\./) === 0) {
                isp = include.substring(4);
                return true;
            }
            return false;
        });
        
        if (!isp) {
            error = C.caligula.errors.LoadBalancerIspNotFoundError(
                'Can not find the ISP name for the load balancer ' + params.node
            );
            logger.error(error);
            callback(error);
            return;
        }
        
        logger.done(isp);
        
        action.data = {
            criteria: { isp: isp }
        };
        
        logger.start('Querying the group belongs to ISP ' + isp);
        
        action.acquire('data.publishing.group.read', function (error, result) {
            var upstreams = [],
                mapping = { uid: [], geo: [] },
                strategies = { uid: [], geo: [] },
                path = null,
                key = null;
                
            action.data = params;
            
            if (error) {
                logger.error(error);
                callback(error);
                return;
            }
            
            logger.done(result);
            if (0 === result.affected) {
                self.logger_.warn('No publishing group belongs to ISP ' + isp);
                callback();
                return;
            }
            
            logger.start('Generating context data for the strategies');
            try {
                result.data.forEach(function (group, index) {
                    key = 'G' + (index + 1);
                
                    upstreams.push({
                        name: group.name,
                        members: group.backends
                    });
                
                    switch (group.strategy.type) {
                    case 'UID':
                        mapping.uid.push({
                            group: key,
                            upstream: group.name
                        });
                        path = C.natives.path.resolve(
                            self.root_, group.strategy.file
                        );
                        strategies.uid.push(
                            'weibo_uid_match_rule ' + key + ' "' + path + '"'
                        );
                        self.addFileResource_(configuration, key, 
                                              path, group.strategy.file);
                    
                        break;
                    case 'IP-RANGE':
                        mapping.geo.push({
                            group: key,
                            upstream: group.name
                        });
                        strategies.geo.push({
                            city: group.strategy.city,
                            path: C.natives.path.resolve(self.root_, 
                                                         group.strategy.city),
                            group: key
                        });
                        break;
                    case 'UID-TAIL':
                        mapping.uid.push({
                            group: key,
                            upstream: group.name
                        });
                        strategies.uid.push('weibo_uid_tail_rule ' + key + 
                                            ' "' + group.strategy.tail + '"');
                        break;
                    default:
                        throw new C.caligula.errors.UnsupportedStrategyTypeError(
                            'Unsupported strategy type "' + 
                            group.strategy.type + '" is found'
                        );
                        break;
                    }
                });
            } catch (e) {
                logger.error(e);
                callback(e);
                return;
            }
            
            configuration.context = configuration.context || {};
            configuration.context.upstreams = upstreams;
            configuration.context.mapping = mapping;
            configuration.context.strategies = strategies;
            
            logger.done(configuration.context);
            callback();
        });
    };
    
    /**
     * Add a file resource to the configuration.resources
     *
     * @method addFileResource_
     * @param {Object} configuration the configuration object
     * @param {String} name the resource name, normally the mapping key, like G1
     * @param {String} path the path where the file to be deployed onto the
     *                      load balancer
     * @param {String} file the file basename which is used to fetch the 
     *                      download URL from file management API
     */
    LoadBalancerPrefilter.prototype.addFileResource_ = function (configuration, 
                                                                 name, path, 
                                                                 file) {
        
        var resources = null;
        configuration.resources = configuration.resources || {};
        resources = configuration.resources;
        resources[name] = {
            type: 'file',
            path: path,
            user: 'www',
            group: 'www',
            mode: '644',
            source: 'file//' + file
        };
    };
    
    
    C.namespace('caligula.configuration.filters').LoadBalancerPrefilter = LoadBalancerPrefilter;
    
    
    /**
     * This type of error is thrown when the ISP name for the load balancer
     * can not be found from its includes property
     *
     * @class LoadBalancerIspNotFoundError
     * @constructor
     * @extends NotFoundError
     * @param {String} message the message describes this error
     */
    function LoadBalancerIspNotFoundError (message) {
        /* inheritance */
        this.super(8, message);
    }
    
    C.lang.inherit(LoadBalancerIspNotFoundError, C.caligula.errors.NotFoundError);
    
    C.namespace('caligula.errors').LoadBalancerIspNotFoundError = LoadBalancerIspNotFoundError;
        
        
    /**
     * This type of error is thrown when the strategy type that user specified
     * is not supported
     *
     * @class UnsupportedStrategyTypeError
     * @constructor
     * @extends NotFoundError
     * @param {String} message the message describes this error
     */
    function UnsupportedStrategyTypeError (message) {
        /* inheritance */
        this.super(2, message);
    }
    
    C.lang.inherit(UnsupportedStrategyTypeError, C.caligula.errors.UnsupportedTypeError);
    
    C.namespace('caligula.errors').UnsupportedStrategyTypeError = UnsupportedStrategyTypeError;
    

}, '0.0.1', { requires: ['caligula.components.configuration.filters.base'] });