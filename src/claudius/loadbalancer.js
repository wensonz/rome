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
            self = this,
            logger = C.logging.getStepLogger(this.logger_),
            isp = null,
            property = null,
            node = null,
            error = null;
            
        // configuration.context.asset.includes
        logger.start('Searching for the ISP this load balancer belongs to');
        node = configurations[params.node];
        // node MUST exist
        node.includes.forEach(function (include) {
            if (include.search(/isp\./) === 0) {
                isp = include.substring(4);
            } else if (include.search(/property\./) === 0) {
                property = include.split('.')[1];
            }
        });
        
        if (!isp) {
            error = C.caligula.errors.LoadBalancerIspNotFoundError(
                'Can not find the ISP name for the load balancer ' + params.node
            );
            logger.error(error);
            callback(error);
            return;
        }

        if (!property) {
            error = C.caligula.errors.LoadBalancerPropertyNotFoundError(
                'Can not find the name of the property which this load ' +
                'balancer ' + params.node + ' belongs to'
            );
            logger.error(error);
            callback(error);
            return;
        }
        
        logger.done(isp);
        
        action.data = {
            criteria: { isp: isp, proeprty: property }
        };
        
        logger.start('Querying the group belongs to ISP ' + isp);
        
        action.acquire('data.publishing.group.read', function (error, result) {
            var upstreams = null,
                mapping = null,
                strategies = null,
                context = null,
                path = null,
                key = null,
                defaults = null,
                unique = {};
                
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
            
            configuration.context = configuration.context || {};
            context = configuration.context;
            
            context.upstreams = context.upstreams || [];
            context.mapping = context.mapping || {
                uid: [], geo: []
            };
            context.strategies = context.strategies || {
                uid: [], geo: []
            };
            
            upstreams = context.upstreams;
            mapping = context.mapping;
            strategies = context.strategies;
            
            upstreams.some(function (upstream) {
                // if (upstream.name === 'default.weibo.com') {
                if (upstream.name === context['default-upstream']) {
                    defaults = upstream;
                    return true;
                }
                return false;
            });
            
            if (!defaults) {
                // defaults = { name: 'default.weibo.com', members: [] };
                defaults = { name: context['default-upstream'], members: [] };
                upstreams.push(defaults);
            }
            
            logger.start('Generating context data for the strategies');
            try {
                result.data.forEach(function (group, index) {
                    key = 'G' + (index + 1);
                    
                    if (group.pause) {
                        self.logger_.warn('Group ' + group.name + 
                                          ' is paused now, nothing is to be ' +
                                          'generated');
                        return;
                    }

                    if (!group.strategy) {
                        // TODO: unique the backends
                        defaults.members = defaults.members.concat(
                            group.backends
                        );
                        return;
                    }
                    
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
                            self.root_, 'uid', group.strategy.file
                        );
                        strategies.uid.push(
                            'weibo_uid_match_rule ' + key + ' "' + path + '"'
                        );
                        self.addFileResource_(configuration, key, 
                                              path, group.strategy.file);
                    
                        break;
                    case 'IP-RANGE': // TODO: rename to 'GEO'
                        mapping.geo.push({
                            group: key,
                            upstream: group.name
                        });
                        strategies.geo.push({
                            city: group.strategy.city,
                            path: C.natives.path.resolve(self.root_, 'geo',
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
            source: 'file://' + file
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
     * This type of error is thrown when the name of the property which the load
     * balancer belongs to can not be found from its inclusions.
     *
     * @class LoadBalancerPropertyNotFoundError
     * @constructor
     * @extends NotFoundError
     * @param {String} message the message describes this error
     */
    function LoadBalancerPropertyNotFoundError (message) {
        /* inheritance */
        this.super(9, message);
    }
    
    C.lang.inherit(LoadBalancerPropertyNotFoundError, C.caligula.errors.NotFoundError);
    
    C.namespace('caligula.errors').LoadBalancerPropertyNotFoundError = LoadBalancerPropertyNotFoundError;

        
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
