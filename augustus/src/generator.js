/**
 * This module contains the definition of the abstract base of the generator,
 * which is designed to generate the configurations for a specified node.
 * 
 * @module caligula.components.configuration.generator
 */
Condotti.add('caligula.components.configuration.generator', function (C) {
    /**
     *
     * @class GenerationHandler
     * @constructor
     * @extends Handler
     * @param {Object} config the config object for this generation handler
     * @param {DottiFactory} factory the object factory used to get filters and
     *                               resource processors
     */
    function GenerationHandler(config, factory) {
        // TODO: use factory to get filters and resource processors, or
        //       pass them as params of the constructor
        
        /* inheritance */
        this.super();
        
        /**
         * The config object for this generation handler
         * 
         * @property config_
         * @type Object
         */
        this.config_ = config;
        
        /**
         * The dotti factory used to get the filters and resource processors
         * 
         * @property factory_
         * @type DottiFactory
         */
        this.factory_ = factory;
        
        // TODO: add dot support to the dotti factory
        
        /**
         * The path to locate the filter functions from Condotti instance
         * 
         * @property filters_
         * @type String
         */
        this.filters_ = this.config_.filters || 'configuration.filters';
        
        /**
         * The path to locate the resource processors from Condotti instance
         * 
         * @property resources_
         * @type String
         */
        this.resources_ = this.config_.processors || 'configuration.resources';
        
        /**
         * The configuration merger used to merge data when generating
         * configuration for user specified node
         * 
         * @property merger_
         * @type String
         */
        this.merger_ = this.config_.merger || 'configuration.merger';
        
        /**
         * The information about generations currently in process, such as the
         * names of the node and the tags to generate
         * 
         * @property generating_
         * @type Object
         * @default {}
         */
        this.generating_ = {};
    }

    C.lang.inherit(GenerationHandler, C.caligula.handlers.Handler);

    /**
     * Generate the configuration for the specified node.
     *
     * @method call
     * @param {Action} action the generation action to be handled
     */
    GenerationHandler.prototype.call = function (action) {
        // steps:
        // 1. read the node with the tag
        // 2. read the roles node includes with the tag
        // 3. execute the pre-filters
        // 4. merge
        // 5. execute the post-filters
        // 6. generate with all kinds of resource generators
        // 7. create RPM?
        /*
        {
            name: ${role/node name},
            revision: ${revision},
            includes: [],
            type: 'node'/'role',
            filters: {
                before: [],
                after: []
            },
            resources: {
                '/etc/http.conf': {
                    'type': 'template',
                    'path': '/etc/http.conf',
                    'owner': 'nobody',
                    'group': 'nobody',
                    'mode': '0755',
                    'content': '${content of the template}'
                },
                'vhost.conf': {
                    'type': 'vhost',
                    'path': '/etc/httpd/{vhost.name}.conf',
                    'owner': 'nobody',
                    'group': 'nobody',
                    'mode': '0755',
                    'content': '${content of vhost template}'
                },
                'hosts.conf': {
                    'type': 'file', // plain file
                    'path': '/etc/hosts.conf',
                    'owner': 'root',
                    'group': 'root',
                    'mode': '0644'
                }
            },
            context:{
                'apache': {
                    'vhosts': {}
                }
            }
        }
        */
        var self = this,
            params = action.data,
            message = null,
            configurations = {},
            dependencies = null,
            names = null,
            merged = null;
        
        // TODO: handle the case when there is already a job to generate the
        //       configuration for this node and with this tag
        
        // TODO: check the params
        C.async.waterfall([
            function (next) { // reading revision number from TAG
                message = 'Expand the TAG ' + params.tag + 
                          ' into the configurations';
                          
                self.logger_.debug(message + ' ...');
                action.data = {
                    criteria: { '$or': [
                        { type: 'role' },
                        { type: 'node', name: params.node }
                    ]},
                    tag: params.tag 
                };
                action.acquire('configuration.tag.expand', next);
            },
            function (result, meta, next) { // Reading the node information if the
                                      // does not exist when the tag is created
                var node = null;
                
                self.logger_.debug(message + ' succeed. Result: ' + 
                                   C.lang.reflect.inspect(result));
                
                
                result.data.forEach(function (item) {
                    configurations[item.name] = item;
                    if (item.type === 'node') { 
                        node = true;
                    }
                });
                
                if (node) { // node configuration is found
                    next();
                    return;
                }
                
                message = 'Node ' + params.node + ' seems not exist when tag ' +
                          params.tag + ' is created. Reading its most recent ' +
                          'version';
                self.logger_.debug(message + ' ...');
                action.data = { criteria: { name: params.node, type: 'node' }};
                action.acquire('configuration.read', next);
            },
            function (result, meta, next) { // Filter out the list of roles the
                                      // user specified node depends on directly
                                      // or indirectly, and also the filters
                                      // to be executed
                
                if (result) { // node exists
                    self.logger_.debug(message + ' succeed. Result: ' +
                                       C.lang.reflect.inspect(result));
                    // TODO: double check if the result.data[0] exist
                    configurations[result.data[0].name] = result.data[0];
                }
                
                // filter out the dependencies of the user specified node
                names = C.algorithm.sorting.topology(
                    params.node,
                    function (name) { return configurations[name].includes; }
                );
                dependencies = names.map(function (name) { 
                    return configurations[name]; 
                });
                
                self.logger_.debug('Dependencies of the node ' + 
                                   params.node + ' are ' +
                                   C.lang.reflect.inspect(names));
                                   
                message = 'Executing "before" filters on the dependencies of ' +
                          'node ' + params.node + ': ' + 
                          C.lang.reflect.inspect(names);
                          
                self.logger_.debug(message + ' ...');
                // Execute 'before' filters of each configuration object in
                // parallel
                self.prefilterConfigurations_(dependencies, next);
            },
            function (next) { // merge all configurations into one object
                var merger = null;
                
                self.logger_.debug(message + ' succeed.');
                message = 'Merging configurations for node ' + params.node + 
                          ' from ' + C.lang.reflect.inspect(names);
                self.logger_.debug(message + ' ...');
                /**
                 * The merged object is expected to contain the following info:
                 * 1. resources
                 * 2. context
                 * 3. node
                 * 4. dependencies
                 */
                merger = self.factory_.get(self.merger_);
                
                try {
                    merged = merger.merge(dependencies);
                } catch (e) {
                    next(e);
                }
                self.logger_.debug(message + ' succeed. Merged: ' + 
                                   C.lang.reflect.inspect(merged));
                
                message = 'Executing "after" filters on the merged ' +
                          'configuration ' + C.lang.reflect.inspect(merged);
                self.logger_.debug(message + ' ...');
                // Execute "after" filters on merged result
                self.postfilterConfigurations_(action, merged, dependencies, 
                                               next);
            },
            function (next) {
                self.logger_.debug(message + ' succeed. Merged: ' +
                                   C.lang.reflect.inspect(merged));
                                   
                // Process resources in the merged configuration
                message = 'Processing the merged resources ' +
                          C.lang.reflect.inspect(merged.resources) + 
                          ' with context ' + 
                          C.lang.reflect.inspect(merged.context);
                self.logger_.debug(message + ' ...');
                
                self.processResources_(merged, next);
            }
        ], function (error, result) {
            if (error) {
                self.logger_.error(message + ' failed. Error: ' +
                                   C.lang.reflect.inspect(error));
                action.error(error);
                return;
            }
            self.logger_.debug(message + ' succeed. Result: ' +
                               C.lang.reflect.inspect(result));
            action.done(result);
        });
    };
    
    /**
     * Excute the "after" filters on the merged configuration object
     * 
     * @method postfilterConfigurations_
     * @param {Action} action the generation action used to acquire other action
     * @param {Object} data the merged configuration data object
     * @param {Array} configurations the list of configurations related with
     *                               this generation
     * @param {Function} callback the callback function to be invoked when the
     *                            filters are executed successfully, or some
     *                            error occurs. The signature of the callback is
     *                            'function (error) {}'
     */
    GenerationHandler.prototype.postfilterConfigurations_ = function (action,
                                                                      data,
                                                                      configurations,
                                                                      callback) {
        var self = this,
            message = null,
            indexes = {},
            filters = null;
        
        // Sort the post filters
        configurations.forEach(function (configuration) {
            var after = null;
            
            filters = configuration.filters || {},
            after = filters.after || [];
            
            after.forEach(function (filter, index) {
                var current = indexes[filter] || 0;
                indexes[filter] = Math.max(current, index);
            });
        });
        
        filters = Object.keys(indexes);
        filters.sort(function (a, b) { return indexes[a] - indexes[b]; });
        
        this.logger_.debug('Postfiltering merged configuraion ' + 
                           C.lang.reflect.inspect(data) + ' with filters: ' +
                           C.lang.reflect.inspect(filters) + ' ...');
                           
        C.async.forEachSeries(filters, function (filter, next) {
                
            if (message) {
                self.logger_.debug(message + ' succeed. Merged: ' +
                                   C.lang.reflect.inspect(data));
            }
            
            message = 'Executing post filter ' + filter;
            self.logger_.debug(message + ' ...');
            
            filter = self.factory_.get(self.filters_ + '.' + filter);
            // TODO: check filter
            //       
            filter.execute(action, data, configurations, next);
            
        }, function (error) {
            if (error) {
                self.logger_.debug(message + ' failed. Error: ' +
                                   C.lang.reflect.inspect(error));
                self.logger_.debug('Postfiltering merged configuration ' +
                                   'with filters: ' +
                                   C.lang.reflect.inspect(filters) +
                                   ' failed.');
                callback(error);
                return;
            }
            
            self.logger_.debug(message + ' succeed.');
            self.logger_.debug('Filtering configuration with filters: ' +
                               C.lang.reflect.inspect(filters) + 
                               ' succeed. Merged: ' +
                               C.lang.reflect.inspect(data));
            callback();
        });
    };
    
    /**
     * Process the resources with the passed in data
     * 
     * @method processResources_
     * @param {Object} data the data contains the resources and other context
     * @param {Function} callback the callback function to be invoked when the
     *                            resource processors are executed successfully,
     *                            or some error occurs. The signature of the 
     *                            callback is 'function (error, result) {}'
     */
    GenerationHandler.prototype.processResources_ = function (data, callback) {
        var self = this,
            resources = data.resources,
            context = data.context,
            results = {};
        
        C.async.forEach(Object.keys(resources), function (name, next) {
            var resource = null,
                processor = null,
                message = null;
            
            resource = resources[name];
            message = 'Processing resource ' + name + ' ' + 
                      C.lang.reflect.inspect(resource) + ' with context ' +
                      C.lang.reflect.inspect(context);
                      
            self.logger_.debug(message + ' ...');
            
            processor = self.factory_.get(self.resources_ + '.' + resource.type);
            // TODO: add processor factory?
            processor.process(resource, context, function (error, result) {
                if (error) {
                    self.logger_.debug(message + ' failed. Error: ' +
                                       C.lang.reflect.inspect(error));
                    next(error);
                    return;
                }
                self.logger_.debug(message + ' succeed. Result: ' + 
                                   C.lang.reflect.inspect(result));
                results[name] = result;
                next();
            });
        }, function (error) {
            callback(error, results);
        });
    };
    
    /**
     * Execute the pre-filters of each configurations related with the user
     * specified node
     * 
     * @method prefilterConfigurations_
     * @param {Action} action the generation action used to acquire other action
     * @param {Array} configurations the list of configuration whose filters are
     *                               to be executed
     * @param {Function} callback the callback function to be invoked when the
     *                            filters are executed successfully, or some
     *                            error occurs. The signature of the callback is
     *                            'function (error) {}'
     */
    GenerationHandler.prototype.prefilterConfigurations_ = function (action,
                                                                     configurations, 
                                                                     callback) {
        
        var self = this;
        
        C.async.forEach(configurations, function(configuration, next) {
            var filters = null,
                message = null;
            
            filters = configuration.filters ? configuration.filters.before: [];
            
            self.logger_.debug('Filtering configuration ' + configuration.name +
                               ' with filters: ' +
                               C.lang.reflect.inspect(filters) + ' ...');
                               
            C.async.forEachSeries(filters, function (filter, next) {
                
                if (message) {
                    self.logger_.debug(message + ' succeed.');
                }
                
                message = 'Executing filter ' + filter + ' for configuration ' +
                          configuration.name;
                          
                self.logger_.debug(message + ' ...');
                
                filter = self.factory_.get(self.filters_ + '.' + filter);
                // TODO: check filter
                //       
                filter.execute(action, configuration, next);
                
            }, function (error) {
                if (error) {
                    self.logger_.debug(message + ' failed. Error: ' +
                                       C.lang.reflect.inspect(error));
                    self.logger_.debug('Filtering configuration ' + 
                                       configuration.name + ' with filters: ' +
                                       C.lang.reflect.inspect(filters) +
                                       ' failed.');
                    next(error);
                    return;
                }
                
                self.logger_.debug(message + ' succeed.');
                self.logger_.debug('Filtering configuration ' + 
                                   configuration.name + ' with filters: ' +
                                   C.lang.reflect.inspect(filters) + 
                                   ' succeed.');
                next();
            });
            
        }, callback);
    };
    
    C.namespace('caligula.handlers.configuration').GenerationHandler = GenerationHandler;

}, '0.0.1', { requires: ['caligula.handlers.base'] });
