/**
 * This module contains the version 2 implementation of the group-based 
 * publishing APIs for Weibo master site.
 * 
 * @module caligula.components.publishing.group
 */
Condotti.add('caligula.components.publishing.group', function (C) {
    
    var GroupState = {
        RUNNING: 0,
        DONE: 1,
        FAILED: 2
    };
    
    C.namespace('caligula.publishing.group').GroupState = GroupState;
    
    var JobState = C.namespace('caligula.orchestration').JobState;
    var NodeState = C.namespace('caligula.orchestration').NodeState;
    
    /**
     * This GroupHandler class is a child class of Handler, and designed to
     * handle the group related actions, such as create, update, and publish
     * etc.
     *
     * TODO: add data structure of the group, operation and status objects
     * 
     * @class GroupHandler
     * @constructor
     * @extends Handler
     * @param {Object} config the config object for this handler
     */
    function GroupHandler (config) {
        /* inheritance */
        this.super();

        /**
         * The config object for this handler
         * 
         * @property config_
         * @type Object
         */
        this.config_ = config || {};

        /**
         * The timeout settings
         *
         * @property timeouts_
         * @type Object
         */
        this.timeouts_ = {
            lease: 10 * 1000, // 10 sec for a lock to be released automatically
            timer: 5 * 1000, // 5 sec for a timer to be triggered to check 
                             // the status
            orchestration: {
                backends: 10 * 60 * 1000, // 10 min for package installation
                loadbalancers: 5 * 60 * 1000 // 5 min for load balancer to reload
            }
        };

        /**
         * The command to be executed on backends/loadbalancers to update their
         * configuration
         *
         * @property command_
         * @type String
         * @default '/usr/local/sinasrv2/sbin/rome-config-sync'
         */
        this.command_ = this.config_.command || 
                        '/usr/local/sinasrv2/sbin/rome-config-sync';

        /* initialize */
        C.lang.merge(this.timeouts_, this.config_.timeouts);
    }
    
    C.lang.inherit(GroupHandler, C.caligula.handlers.Handler);
    
    /**
     * Return the status of the specified group
     *
     * @method status
     * @param {Action} action the status querying action to be handled
     */
    GroupHandler.prototype.status = function (action) {
        var params = action.data,
            self = this,
            locked = false,
            internal = params.internal || false,
            group = null, // group object
            log = null, // operation log
            jobs = null, // orchestration jobs
            logger = C.logging.getStepLogger(this.logger_);
            
        // Remove the internal flag first
        delete params.internal;
        
        C.async.waterfall([
            function (next) { // Query the lock state
                logger.start('Querying the state of  lock "publishing.group.' +
                             params.name + '"');
                
                if (internal) { // the lock is supposed to have been acquired
                    next(null, { acquired: true }, null);
                    return;
                }
                
                action.data = { name: 'publishing.group.' + params.name };
                action.acquire('lock.acquired', next);
            },
            function (result, unused, next) { // Read the group data
                logger.done(result);
                locked = result.acquired;
                
                logger.start('Reading the details of the group ' + params.name);
                action.data = { criteria: { name: params.name }};
                action.acquire('data.publishing.group.read', next);
            },
            function (result, unused, next) { // Read the most recent operation
                                              // log
                logger.done(result);
                
                if (result.affected > 0) {
                    group = result.data[0];
                }
                
                logger.start('Reading the most recent operation log of the ' +
                             'group ' + params.name);
                //
                action.data = {
                    criteria: { 'group.name': params.name },
                    operations: {
                        sort: { timestamp: -1 },
                        limit: 1
                    }
                };
                action.acquire('data.publishing.group.operation.read', next);
            },
            function (result, unused, next) { // Read the orchestration job data
                logger.done(result);
                
                if (0 === result.affected) {
                    next(null, null, null);
                    return;
                }
                
                log = result.data[0];
                if (log.status) {
                    self.logger_.debug('Operation ' + 
                                       C.lang.reflect.inspect(log) + 
                                       ' has been completed.');
                    next(new C.caligula.errors.FoundRedirection());
                    return;
                }
                
                logger.start('Reading the orchestration job for operation ' +
                             log.id + ' of group ' + params.name);
                //
                action.data = { criteria: { 
                    'extras.group': params.name,
                    'extras.operation': log.id
                }};
                action.acquire('orchestration.read', next);
            },
            function (result, unused, next) {
                
                if (!result) {
                    next(null, null);
                    return;
                }
                
                logger.done(result);
                
                if (0 === result.affected) {
                    next(null, null);
                    return;
                }
                // multi jobs
                jobs = result.data;
                logger.start('Query the status of orchestration jobs ' + 
                             jobs.map(function (job) { return job.id; }));
                             
                // Query the status of the jobs serially
                C.async.mapSeries(jobs, function (job, next) {
                    action.data = { id: job.id };
                    action.acquire('orchestration.stat', next);
                }, next);
            },
            function (result, next) { // Build the status object
                var status = {},
                    running = false,
                    failed = false;
                
                if (result) {
                    logger.done(result);
                }
                
                logger.start('Building the status object for group ' + 
                             params.name);
                if (!group) {

                    if (!log) { // not found
                        next(new C.caligula.errors.GroupNotFoundError(
                            'Required group ' + params.name + ' does not exist'
                        ));
                        return;
                    }
                    
                    if (log.operator === 'create') { // group creation failed
                        // In this scenario, the 'group' property of the result
                        // status object is undefined
                        status = {
                            state: GroupState.FAILED,
                            operator: log.operator,
                            params: log.params
                        };
                        next(null, status);
                        return;
                    }

                    if (log.operator !== 'delete') { // no group, but not 
                                                     // deleted either
                        next(new C.caligula.errors.InternalServerError(
                            'A "delete" operation is expected since the group ' +
                            params.name + ' does not exist, but a "' + 
                            log.operator + '" operation is found'
                        ));
                        return;
                    }
                    
                    // the most recent operation is 'delete'
                    group = log.group;
                }
                
                // log MUST exist
                status.operator = log.operator;
                status.params = log.params;
                status.group = group; // current group object, or the snapshot
                                      // one in a 'delete' operation
                
                if (!jobs) { // orchestration jobs not created
                    // Since all operations require orchestration's
                    // help, it's supposed to be failed if there is no
                    // job created and the lock is not locked
                    status.state = (!internal && locked) ? GroupState.RUNNING : 
                                                           GroupState.FAILED;
                    // There is no 'details' property in the result status
                    // object, which indicates the operation stops when creating
                    // required orchestration jobs
                    next(null, status);
                    return;
                }
                
                // search for the minimum job state
                running = result.some(function (state) {
                    return state.job === JobState.RUNNING ||
                           state.job === JobState.CANCELLING;
                });
                status.state = running ? GroupState.RUNNING : GroupState.DONE;

                if (status.state === GroupState.DONE) { 
                    if (status.operator === 'delete') {
                        next(new C.caligula.errors.GroupNotFoundError(
                            'Required group ' + params.name + ' does not exist'
                        ));
                        return;
                    }

                    if (jobs.length !== log.jobs) {
                        failed = true; // operation failed due to the creation
                                       // of some orchestration job failed
                    }
                }
                
                //
                status.details = {};
                jobs.forEach(function (job, index) {
                    var nodes = result[index].nodes;
                    status.details[job.extras.affected] = nodes;
                    
                    if ((status.state !== GroupState.DONE) && failed) {
                        return;
                    }

                    failed = nodes.some(function (node) {
                        return node.error && node.error.code !== 40800;
                               // TODO: replace the constant 40800 with concrete
                               //       error type
                    });
                });


                // Group is supposed to be failed even if a single failure
                // occurs on a backend/nginx
                if (failed) {
                    status.state = GroupState.FAILED;
                }
                
                next(null, status);
            },
            function (status, next) {
                logger.done(status);
                
                if (status.state === GroupState.RUNNING) {
                    next(null, status);
                    return;
                }
                
                logger.start('Saving the generated status object ' +
                             C.lang.reflect.inspect(status) + 
                             ' into operation log ' + log.id);
                action.data = {
                    criteria: { id: log.id },
                    update: {
                        '$set': { status: status }
                    }
                };
                action.acquire(
                    'data.publish.group.operation.update', 
                    function (error, result) {
                        if (error) {
                            logger.error(error);
                        } else {
                            logger.done(result);
                        }
                        next(null, status);
                    }
                );
            }
        ], function (error, status) {
            if (error) {
                if (error instanceof C.caligula.errors.FoundRedirection) {
                    status = log.status;
                } else {
                    logger.error(error);
                    action.error(error);
                    return;
                }
            }
            
            action.done(status);
        });
    };
    
    /**
     * Publish a new version of package onto the specified group
     *
     * @method publish
     * @param {Action} action the publishing action to be handled
     */
    GroupHandler.prototype.publish = function (action) {
        var params = action.data,
            self = this,
            logger = C.logging.getStepLogger(this.logger_),
            locks = null,
            group = null,
            tag = null,
            log = null; // the publishing operation log
            
        // STEPS:
        //  1. lock the group operation
        //  2. query the current status
        //  3. create operation log
        //  4. update group data
        //  5. create TAG
        //  6. create orchestration job
        //  7. return
        
        C.async.waterfall([
            function (next) { // Lock the operation log 
                logger.start('Acquiring the operation lock for group ' +
                             params.name);
                             
                // self.lock_(action, 'publishing.group.' + params.name, next);
                self.lockGroupAndBackends_(action, params.property, params.name, 
                                           false, next);
            },
            function (result, next) { // Query the current status
                logger.done(result);
                locks = result;
                
                logger.start('Querying current status of group ' + params.name);
                action.data = {
                    name: params.name,
                    internal: true
                };
                action.acquire(action.name.replace(/publish$/, 'status'), next);
            },
            function (status, unused, next) { // Create an operation log

                logger.done(status);
                logger.start('Checking if the group ' + params.name + 
                             ' is available for new publishing');
                
                if (status.state === GroupState.RUNNING) {
                    next(new C.caligula.errors.OperationConflictError(
                        'Another "' + status.operator + '" operation is now ' +
                        'running on the specified group ' + params.name
                    ));
                    return;
                }
                
                // Group was tried to be deleted, but failed. If the deleting
                // operation succeeds, "status" API will return a 
                // GroupNotFoundError, which will cause the flow ended
                if (status.operator === 'delete') {
                    next(new C.caligula.errors.GroupGoneError(
                        'Required group ' + params.name + 
                        ' has been or is gonna be deleted'
                    ));
                    return;
                }

                logger.done();
                group = status.group;

                logger.start('Creating publishing operation log for group ' + 
                             params.name);
                log = { 
                    id: C.uuid.v4(),
                    group: group,
                    operator: 'publish',
                    params: params,
                    timestamp: Date.now(),
                    jobs: 1
                };

                action.data = log;
                action.acquire('data.publishing.group.operation.create', next);
            },
            function (result, unused, next) { // Update the group data
                var package = null;

                logger.done(result);

                if (!params.package) {
                    package = group.package || { 
                        name: 'trunk', version: 'latest'
                    };

                    self.logger_.warn('No package is specified in params, ' +
                                      'current configured package ' +
                                      package.name + '@' + package.version +
                                      ' is to be used');
                    next(null, null, null);
                    return;
                }

                action.data = {
                    criteria: { name: params.name },
                    update: { '$set': {
                        package: params.package
                    }}
                };
                logger.start('Updating the package for group ' + params.name +
                             ' to ' + params.package.name + '@' + 
                             params.package.version);

                action.acquire('data.publishing.group.update', next);
            },
            function (result, unused, next) { // Create configuration TAG
                if (result) {
                    logger.done(result);
                }
                
                // Update the package field for calling updateBackends_
                group.package = params.package;

                tag = 'TAG_GROUP_' + params.name.toUpperCase() + 
                      '_PUBLISH@' + Date.now().toString();

                logger.start('Tagging the new configuration for group ' +
                             params.name + ' with tag ' + tag);

                action.data = { name: tag };
                action.acquire('configuration.tag.create', next);
            },
            function (result, unused, next) { // Creat orchestration job
                logger.done(result);
                logger.start('Sending notification to update the package on ' +
                             'backends ' + group.backends.toString() + 
                             ' of group ' + params.name);
                             
                self.updateBackends_(action, group, group.backends, log, tag, 
                                     next);
            }
        ], function (error, result) {
            self.unlockGroupAndBackends_(action, locks, function () {
                if (error) {
                    logger.error(error);
                    action.error(error);
                    return;
                }
                
                logger.done(result);
                action.done();
            });
        });
    };


    /**
     * Create a new group with the specified params.
     *
     * @method create
     * @param {Action} action the group creation action to be handled
     */
    GroupHandler.prototype.create = function (action) {
        var self = this,
            params = action.data,
            locks = null,
            group = null,
            log = null,
            tag = null,
            logger = C.logging.getStepLogger(this.logger_);

        C.async.waterfall([
            function (next) { // Lock the group and backends
                logger.start('Acquiring the lock on on group ' + params.name +
                             ' and backends for resource allocation');

                self.lockGroupAndBackends_(action, params.property, params.name, 
                                           true, next);
            },
            function (result, next) { // Read current status of the group
                var name = null;
                
                logger.done(result);
                locks = result;
                
                logger.start('Querying current status of group ' + params.name);
                action.data = {
                    name: params.name,
                    internal: true
                };
                
                name = action.name.replace(/create$/, 'status');
                action.acquire(name, function (error, result) {
                    if (error && error instanceof GroupNotFoundError) {
                        logger.done('Group ' + params.name + 
                                    ' did not exist before.');
                        next(null, null, null);
                        return;
                    }
                    next(error, result, null);
                });
            },
            function (status, unused, next) { // check group status if existing
                
                if (!status) { // group not exist before
                    next();
                    return;
                }

                logger.done(status);
                
                logger.start('Checking if the group ' + params.name + 
                             ' is available for creating');
                         
                if (status.state === GroupState.RUNNING) {
                    next(new C.caligula.errors.OperationConflictError(
                        'Another "' + status.operator + '" operation is ' +
                        'now running on the specified group ' + params.name
                    ));
                    return;
                }

                // Group was tried to be deleted, but failed. If the deleting
                // operation succeeds, "status" API will return a 
                // GroupNotFoundError, which will cause the flow ended
                if (status.operator !== 'delete') {
                    next(new C.caligula.errors.GroupAlreadyExistError(
                        'Required group ' + params.name + 
                        ' has already existed'
                    ));
                    return;
                }
                
                logger.done();
                next();

            }, function (next) { // allocate backends

                logger.start('Trying to allocate backend servers of ISP ' +
                             params.isp + ' at scale ' + params.scale);
                
                self.allocateBackends_(action, params.property, params.isp, 
                                       params.scale, next);
            },
            function (result, next) { // create operation log
                
                logger.done(result);
                params.backends = result;
                group = params;

                log = {
                    id: C.uuid.v4(),
                    operator: 'create',
                    params: params,
                    timestamp: Date.now(),
                    group: group,
                    jobs: 1
                };

                action.data = log;
                logger.start('Creating the operation log for creating group ' +
                             params.name + ' with params: ' +
                             C.lang.reflect.inspect(action.data));
                action.acquire('data.publishing.group.operation.create', next);
            },
            function (result, unused, next) {
                logger.done(result);
                
                logger.start('Creating the data object for group ' + 
                             params.name);

                action.data = group;
                action.acquire('data.publishing.group.create', next);
            },
            function (result, unused, next) {
                logger.done(result);

                tag = 'TAG_GROUP_' + params.name.toUpperCase() + 
                      '_CREATE@' + Date.now().toString();

                logger.start('Tagging the new configuration for group ' +
                             params.name + ' with tag ' + tag);

                action.data = { name: tag };
                action.acquire('configuration.tag.create', next);
            },
            function (result, unused, next) { // Creat orchestration job
                
                logger.done(result);
                
                logger.start('Sending notification to update the package on ' +
                             'backends ' + group.backends.toString() + 
                             ' of group ' + params.name);
                             
                self.updateBackends_(action, group, group.backends, log, tag, 
                                     next);
            }
        ], function (error, result) {
            
            self.unlockGroupAndBackends_(action, locks, function () {
                if (error) {
                    logger.error(error);
                    action.error(error);
                    return;
                }
                
                logger.done(result);
                action.done(params.backends);
            });
        });
    };
    
    /**
     * Scale the size of the backend servers of the specified group
     *
     * @method scale
     * @param {Action} action the scaling action to be handled
     */
    GroupHandler.prototype.scale = function (action) {
        var params = action.data,
            self = this,
            locks = null,
            group = null,
            log = null,
            tag = null,
            difference = null,
            allocated = null,
            logger = C.logging.getStepLogger(this.logger_);
        
        C.async.waterfall([
            function (next) { // Lock the group and backends
                logger.start('Acquiring the lock on on group ' + params.name +
                             ' and backends for resource allocation');
                self.lockGroupAndBackends_(action, params.property, params.name, 
                                           true, next);
            },
            function (result, next) { // Read current status of the group
                logger.done(result);
                locks = result;
                
                logger.start('Querying current status of group ' + params.name);
                action.data = {
                    name: params.name,
                    internal: true
                };
                action.acquire(action.name.replace(/scale$/, 'status'), next);
            },
            function (status, unused, next) { // allocate the backend servers
                logger.done(status);
                logger.start('Checking if the group ' + params.name + 
                             ' is available for scaling');

                if (status.state === GroupState.RUNNING) {
                    next(new C.caligula.errors.OperationConflictError(
                        'Another "' + status.operator + '" operation is now ' +
                        'running on the specified group ' + params.name
                    ));
                    return;
                }

                // Group was tried to be deleted, but failed. If the deleting
                // operation succeeds, "status" API will return a 
                // GroupNotFoundError, which will cause the flow ended
                if (status.operator === 'delete') {
                    next(new C.caligula.errors.GroupGoneError(
                        'Required group ' + params.name + 
                        ' has been or is gonna be deleted'
                    ));
                    return;
                }

                logger.done();
                group = status.group;
                difference = params.scale - group.scale;

                self.logger_.debug('Current scale of the group ' + params.name +
                                   ' is ' + group.scale + ', the difference ' +
                                   'between it and the new scale ' + 
                                   params.scale + ' is ' + difference);
                
                if (difference === 0) {
                    next(new C.caligula.errors.FoundRedirection());
                    return;
                }
                
                if (difference < 0) {
                    next(null, null);
                    return;
                }
                
                logger.start('Trying to allocate backend servers of ISP ' +
                             group.isp + ' by scale ' + difference);
                
                self.allocateBackends_(action, params.property, group.isp, 
                                       difference, next);
            },
            function (result, next) { // create operation log
                var count = 0;
                
                if (result) {
                    logger.done(result);
                    allocated = result;
                    // params.backends === allocated backends after scaling
                    params.backends = group.backends.concat(allocated);
                }
                
                if (difference < 0) {
                    logger.start('Deallocating backend servers ' + 
                                 group.backends.toString() + ' of group ' + 
                                 group.name + ' from scale ' + group.scale + 
                                 ' to ' + params.scale);
                                 
                    count = Math.ceil(
                        group.backends.length * params.scale / group.scale
                    );
                    
                    params.backends = group.backends.slice(0, count);
                    logger.done(params.backends);
                }
                
                logger.start('Creating scaling operation log for group ' + 
                             params.name);
                log = {
                    id: C.uuid.v4(),
                    group: group,
                    operator: 'scale',
                    params: params,
                    timestamp: Date.now(),
                    jobs: 2 // requires 2 orchestration jobs
                };

                action.data = log;
                action.acquire('data.publishing.group.operation.create', next);
            },
            function (result, unused, next) { // update the group
                logger.done(result);
                
                action.data = {
                    criteria: { name: params.name },
                    update: { '$set': {
                        scale: params.scale,
                        backends: params.backends
                    }}
                };
                logger.start('Updating the scale for group ' + params.name +
                             ' to ' + params.scale);
                action.acquire('data.publishing.group.update', next);
            },
            function (result, unused, next) {
                logger.done(result);
                
                tag = 'TAG_GROUP_' + params.name.toUpperCase() + '_SCALE@' +
                      Date.now().toString();
                
                logger.start('Tagging the new configuration for group ' +
                             params.name + ' with tag ' + tag);
                             
                action.data = { name: tag };
                action.acquire('configuration.tag.create', next);
            },
            function (result, unused, next) { // Creat orchestration job
                logger.done(result);
                
                if (difference < 0) {
                    self.logger_.debug('Scaling group ' + group.name + 
                                       ' in for scale ' + params.scale + 
                                       ', no backend configuration ' +
                                       'updates needed');
                    next(null, null);
                    return;
                }
                
                logger.start('Sending notification to update the package on ' +
                             'new allocated backends ' + 
                             params.backends.toString() + ' of group ' + 
                             params.name);
                             
                self.updateBackends_(
                    action, group, allocated, log, tag, next, 
                    function (state) {
                        var failed = null;
                        failed = Object.keys(state.nodes).some(function (node) {
                            var result = state.nodes[node].result;
                            return !(result && 
                                     result.state === NodeState.EXITED && 
                                     result.code === 0);
                        });
                        if (failed) {
                            self.logger_.error('Updating package on new ' +
                                               'allocated backends ' +
                                               params.backends.toString() +
                                               ' for group ' + params.name +
                                               ' failed. Status: ' + state);
                            return;
                        }
                        
                        logger.start('Sending notification to update the ' +
                                     'loadbalancers affected by group ' +
                                     params.name + ' of ISP ' + group.isp);
                         
                        self.updateLoadBalancers_(action, params.property, 
                                                  group, log, tag);
                    }
                );
            },
            function (result, next) {
                
                if (result) {
                    next(null, result);
                    return;
                }
                
                logger.start('Sending notification to update the ' +
                             'loadbalancers affected by group ' +
                             params.name + ' of ISP ' + group.isp);
                         
                self.updateLoadBalancers_(action, params.property, group, log, 
                                          tag, next);
            }
        ], function (error, result) {
            self.unlockGroupAndBackends_(action, locks, function () {
                if (error) {
                    if (error instanceof C.caligula.errors.FoundRedirection) {
                        self.logger_.debug('No change happened to the group ' +
                                           group.name + 
                                           ' due to the same scale ' +
                                           params.scale + ' specified.');
                                      
                        action.done(group.params);
                        return;
                    }
                    logger.error(error);
                    action.error(error);
                    return;
                }
            
                logger.done(result);
                action.done(params.backends);
            });
        });
    };
    
    /**
     * Apply a new strategy to the specified group
     *
     * @method apply
     * @param {Action} action the application action to be handled
     */
    GroupHandler.prototype.apply = function (action) {
        var params = action.data,
            self = this,
            locks = null,
            group = null,
            log = null,
            tag = null,
            logger = C.logging.getStepLogger(this.logger_);
        
        C.async.waterfall([
            function (next) { // Lock the group and backends
                logger.start('Acquiring the lock on on group ' + params.name);
                self.lockGroupAndBackends_(action, params.property, params.name, 
                                           false, next);
            },
            function (result, next) { // Read current status of the group
                logger.done(result);
                locks = result;
                
                logger.start('Querying current status of group ' + params.name);
                action.data = {
                    name: params.name,
                    internal: true
                };
                action.acquire(action.name.replace(/apply$/, 'status'), next);
            },
            function (status, unused, next) { // create operation log
                logger.done(status);
                logger.start('Checking if the group ' + params.name + 
                             ' is available for applying new strategy');
                             
                if (status.state === GroupState.RUNNING) {
                    next(new C.caligula.errors.OperationConflictError(
                        'Another "' + status.operator + '" operation is now ' +
                        'running on the specified group ' + params.name
                    ));
                    return;
                }
                
                // Group was tried to be deleted, but failed. If the deleting
                // operation succeeds, "status" API will return a 
                // GroupNotFoundError, which will cause the flow ended
                if (status.operator === 'delete') {
                    next(new C.caligula.errors.GroupGoneError(
                        'Required group ' + params.name + 
                        ' has been or is gonna be deleted'
                    ));
                    return;
                }
                
                logger.done();
                group = status.group;
                
                log = {
                    id: C.uuid.v4(),
                    operator: 'apply',
                    params: params,
                    timestamp: Date.now(),
                    group: group,
                    jobs: 1
                };
                
                action.data = log;
                logger.start('Creating the operation log for applying new ' +
                             'strategy ' + 
                             C.lang.reflect.inspect(params.strategy) + 
                             ' to group ' + params.name);
                action.acquire('data.publishing.group.operation.create', next);
            },
            function (result, unused, next) {
                logger.done(result);
                
                if (!params.strategy) {
                    if (group.strategy) {
                        self.logger_.debug('Configuration of the load ' +
                                           'balancers of group ' + group.name +
                                           ' are to be generated again with ' +
                                           'the current strategy ' +
                                           C.lang.reflect.inspect(group.strategy));
                    } else {
                        self.logger_.debug('Backends of group ' + group.name + 
                                           ' are to be onboard into the ' +
                                           'default upstream due to the empty' +
                                           ' strategy received.');
                    }
                    next(null, null, null);
                    return;
                }

                logger.start('Update the strategy of group ' + params.name +
                             ' from ' + C.lang.reflect.inspect(group.strategy) +
                             ' to ' + C.lang.reflect.inspect(params.strategy));
                             
                action.data = {
                    criteria: { name: params.name },
                    update: { '$set': {
                        strategy: params.strategy
                    }}
                };
                action.acquire('data.publishing.group.update', next);
            },
            function (result, unused, next) { // Create configuration TAG
                if (result) {
                    logger.done(result);
                }
                
                tag = 'TAG_GROUP_' + params.name.toUpperCase() + 
                      '_APPLY@' + Date.now().toString();
                
                logger.start('Tagging the new configuration for group ' +
                             params.name + ' with tag ' + tag);
                
                action.data = { name: tag };
                action.acquire('configuration.tag.create', next);
            },
            function (result, unused, next) { // Creat orchestration job
                logger.done(result);
                
                logger.start('Sending notification to loadbalancers to apply' +
                             ' the new strategy ' + 
                             C.lang.reflect.inspect(params.strategy) + 
                             ' on group ' + params.name);
                
                self.updateLoadBalancers_(action, params.property, group, log, 
                                          tag, next);
            }
        ], function (error, result) {
            self.unlockGroupAndBackends_(action, locks, function () {
                if (error) {
                    logger.error(error);
                    action.error(error);
                    return;
                }
            
                logger.done(result);
                action.done();
            });
        });
    };
    
    /**
     * Delete the specified group
     *
     * @method delete
     * @param {Action} action the deleting action to be handled
     */
    GroupHandler.prototype.delete = function (action) {
        var params = action.data,
            self = this,
            locks = null,
            group = null,
            log = null,
            tag = null,
            logger = C.logging.getStepLogger(this.logger_);
        
        C.async.waterfall([
            function (next) { // Lock the group and backends
                logger.start('Acquiring the lock on on group ' + params.name);
                self.lockGroupAndBackends_(action, params.property, params.name, 
                                           false, next);
            },
            function (result, next) { // Read current status of the group
                logger.done(result);
                locks = result;
                
                logger.start('Querying current status of group ' + params.name);
                action.data = {
                    name: params.name,
                    internal: true
                };
                action.acquire(action.name.replace(/delete$/, 'status'), next);
            },
            function (status, unused, next) { // create operation log
                logger.done(status);
                logger.start('Checking if the group ' + params.name + 
                             ' is available for deleting');
                             
                if (status.state === GroupState.RUNNING) {
                    next(new C.caligula.errors.OperationConflictError(
                        'Another "' + status.operator + '" operation is now ' +
                        'running on the specified group ' + params.name
                    ));
                    return;
                }
                
                // Group was tried to be deleted, but failed. If the deleting
                // operation succeeds, "status" API will return a 
                // GroupNotFoundError, which will cause the flow ended
                
                logger.done();
                group = status.group;
                
                log = {
                    id: C.uuid.v4(),
                    operator: 'delete',
                    params: params,
                    timestamp: Date.now(),
                    group: group,
                    jobs: 1
                };
                action.data = log;
                logger.start('Creating the operation log for deleting  group ' + 
                             params.name);
                action.acquire('data.publishing.group.operation.create', next);
            },
            function (result, unused, next) {
                logger.done(result);
                
                logger.start('Deleting group ' + params.name);
                action.data = {
                    criteria: { name: params.name }
                };
                action.acquire('data.publishing.group.delete', next);
            },
            function (result, unused, next) { // Create configuration TAG
                logger.done(result);
                
                tag = 'TAG_GROUP_' + params.name.toUpperCase() + 
                      '_DELETE@' + Date.now().toString();
                
                logger.start('Tagging the new configuration for group ' +
                             params.name + ' with tag ' + tag);
                
                action.data = { name: tag };
                action.acquire('configuration.tag.create', next);
            },
            function (result, unused, next) { // Creat orchestration job
                logger.done(result);
                
                logger.start('Sending notification to loadbalancers to remove' +
                             ' the group ' + params.name);
                             
                self.updateLoadBalancers_(action, params.property, group, log, 
                                          tag, next);
            }
        ], function (error, result) {
            self.unlockGroupAndBackends_(action, locks, function () {
                if (error) {
                    logger.error(error);
                    action.error(error);
                    return;
                }
            
                logger.done(result);
                action.done();
            });
        });
    };
    
    /**
     * Rollback the current package to the most recent succesefully deployed
     * one
     *
     * @method rollback
     * @param {Action} action the rollback action to be handled
     */
    GroupHandler.prototype.rollback = function (action) {
        var params = action.data,
            self = this,
            locks = null,
            group = null,
            log = null,
            tag = null,
            logger = C.logging.getStepLogger(this.logger_);
        
        logger.start('Querying the operation log for the most recent ' +
                     'successful publishing');
         
        action.data = {
            criteria: {
                'params.name': params.name,
                'operator': 'publish',
                'status': {
                    '$exists': true,
                    'state': GroupState.OK
                }
            },
            fields: {
                params: 1
            },
            operations: {
                sort: { timestamp: -1 },
                limit: 1
            }
        };
        
        action.acquire('data.publish.group.operation.read', function (error, 
                                                                      result) {
            if (error) {
                logger.error(error);
                action.error(error);
                return;
            }
            
            logger.done(result);
            if (0 === result.affected) {
                action.error(new C.caligula.errors.OperationLogNotFoundError(
                    'An early successful publishing for group ' + params.name +
                    ' can not be found'
                ));
                return;
            }
            
            self.logger_.debug('Redirecting the rollback operation of group ' +
                               params.name + ' to a new publishing with ' +
                               C.lang.reflect.inspect(result.data[0]));
                               
            action.data = result.data[0];
            self.publish(action);
        })
    };
    
    /**
     * Pause or resume the specified group, which is archieved by blocking or
     * unblocking the port 80 of the backend servers allocated to the group.
     * 
     * @method pause
     * @param {Action} action the pausing/resuming action to be handled
     */
    GroupHandler.prototype.pause = function (action) {
        var params = action.data,
            self = this,
            logger = C.logging.getStepLogger(this.logger_),
            locks = null,
            group = null,
            log = null,
            tag = null;

        C.async.waterfall([
            function (next) { // Lock the operation log 
                logger.start('Acquiring the operation lock for group ' +
                             params.name);
             
                self.lockGroupAndBackends_(action, params.property, params.name, 
                                           false, next);
            },
            function (result, next) { // Query the current status
                logger.done(result);
                locks = result;
                
                logger.start('Querying current status of group ' + params.name);
                action.data = {
                    name: params.name,
                    internal: true
                };
                action.acquire(action.name.replace(/pause$/, 'status'), next);
            },
            function (status, unused, next) { // Create an operation log

                logger.done(status);
                logger.start('Checking if the group ' + params.name + 
                             ' is available for pausing');
                
                if (status.state === GroupState.RUNNING) {
                    next(new C.caligula.errors.OperationConflictError(
                        'Another "' + status.operator + '" operation is now ' +
                        'running on the specified group ' + params.name
                    ));
                    return;
                }
                
                // Group was tried to be deleted, but failed. If the deleting
                // operation succeeds, "status" API will return a 
                // GroupNotFoundError, which will cause the flow ended
                if (status.operator === 'delete') {
                    next(new C.caligula.errors.GroupGoneError(
                        'Required group ' + params.name + 
                        ' has been or is gonna be deleted'
                    ));
                    return;
                }

                logger.done();
                group = status.group;
                
                logger.start('Creating ' + 
                             (params.pause ? 'pausing' : 'resuming') +
                             ' operation log for group ' + params.name);
                log = { 
                    id: C.uuid.v4(),
                    group: group,
                    operator: params.pause ? 'pause' : 'resume',
                    params: params,
                    timestamp: Date.now(),
                    jobs: 1
                };

                action.data = log;
                action.acquire('data.publishing.group.operation.create', next);
            },
            function (result, unused, next) { // Update the group data
                logger.done(result);

                action.data = {
                    criteria: { name: params.name },
                    update: { '$set': {
                        pause: params.pause
                    }}
                };
                logger.start('Updating the group ' + params.name +
                             ' to be ' + params.pause ? 'paused' : 'resumed');

                action.acquire('data.publishing.group.update', next);
            },
            function (result, unused, next) { // Creat configuration tag
                logger.done(result);

                tag = 'TAG_GROUP_' + params.name.toUpperCase() + 
                      '_' + (params.pause ? 'PAUSE' : 'RESUME') + '@' + 
                      Date.now().toString();
                
                logger.start('Tagging the new configuration for group ' +
                             params.name + ' with tag ' + tag);
                
                action.data = { name: tag };
                action.acquire('configuration.tag.create', next);
            },
            function (result, unused, next) { // Creat orchestration job
                logger.done(result);
                
                logger.start('Creating orchestration job for ' +
                             (params.pause ? 'pausing' : 'resuming') +
                             ' group ' + params.name);
                
                self.updateLoadBalancers_(action, params.property, group, log, 
                                          tag, next);
            }
        ], function (error, result) {
            self.unlockGroupAndBackends_(action, locks, function () {
                if (error) {
                    logger.error(error);
                    action.error(error);
                    return;
                }

                logger.done(result);
                action.done();
            });
        });
    };

    /**********************************************************************
     *                                                                    *
     *                        PRIVATE MEMBERS                             *
     *                                                                    *
     **********************************************************************/
    
    /**
     * Allocate the required scale of backend servers
     *
     * @method allocateBackends_
     * @param {Action} action the action trigger this allocation
     * @param {String} isp the name of the isp which the backend servers to be
     *                     allocated belong to
     * @param {Number} scale the scale of the backend servers to be allocated
     * @param {Function} callback the callback function to be invoked after the
     *                            required backend servers have been 
     *                            successfully allocated, or some error occurs.
     *                            The signature of the callback function is
     *                            'function (error, backends) {}'
     */
    GroupHandler.prototype.allocateBackends_ = function (action, propery, isp, 
                                                         scale, callback) {
        var self = this,
            logger = C.logging.getStepLogger(this.logger_),
            allocated = null,
            deleted = null,
            needed = 0,
            overall = null;
        
        C.async.waterfall([
            function (next) { // Read all backend servers belong
                              // to the specified ISP
                logger.start('Reading all backend servers belong to ISP ' + isp);
                
                action.data = { criteria: {
                    includes: { '$all': [
                        'property.' + property + '.backend',
                        'isp.' + isp
                    ]},
                    type: 'node'
                }, fields: { name: 1 } };
                
                action.acquire('configuration.read', next);
            },
            function (result, unused, next) { // Read groups belongs to the
                                              // specified ISP
                var error = null;
                
                logger.done(result);
                overall = result.data || [];
                
                if (overall.length === 0) {
                    error = new C.caligula.errors.ResourceNotEnoughError(
                        'There is not a single backend server in ISP ' + isp +
                        ' at all'
                    );
                    self.logger_.error(error.message);
                    next(error);
                    return;
                }
                
                // Note that now only 10% of the overall traffic is allowd to 
                // be redirected to the branched testing groups, so the 
                // calculation is based on 10 and nodes participated in the
                // testing.
                // Note: now that there are only 2 ISPs supported, CNC and CT
                //       and the resources are deployed in two IDCs equally,
                //       so the scale are divided by 5, which means all
                //       resources of one ISP are to be allocated if user
                //       specifies the scale to be 5
                // TODO: convert constant "5" into a calculation of the ratio of
                //       the number of the testing servers over the one of the
                //       production servers
                needed = Math.ceil(overall.length * scale / 5);
                
                logger.start('Reading all groups belong to ISP ' + isp);
                action.data = { 
                    criteria: { isp: isp, property: property }, 
                    fields: { backends: 1 }
                };
                action.acquire('data.publishing.group.read', next);
            },
            function (result, unused, next) { // Read deleting oeprations 
                var count = 0;
                
                logger.done(result);
                allocated = result.data || [];
                
                logger.start('Checking if the avaiable backend servers are ' +
                             'enough for scale ' + scale);
                count = allocated.reduce(function (current, group) {
                    return current + group.backends.length;
                }, 0);
                
                if (overall.length - count < needed) {
                    next(new C.caligula.errors.ResourceNotEnoughError(
                        'Scale ' + scale + ' requires at least ' + needed +
                        ' backend servers, but now at most ' + 
                        (overall.length - count) + ' are available'
                    ));
                    return;
                }
                
                logger.done();
                
                logger.start('Reading deleting operations currently on going');
                action.data = {
                    fields: { group: 1, timestamp: 1, operator: 1, status: 1 },
                    operations: { sort: { timestamp: 1} },
                    by: 'group.name',
                    aggregation: { group: { '$first': 'group' }}
                };
                
                action.acquire('data.publishing.group.operation.group', next);
            },
            function (result, unused, next) { // create operation log
                var unique = {},
                    count = 0,
                    backends = [];
                
                logger.done(result);
                
                result.data = result.data || [];
                // find out the groups that are being deleted or failed to be
                // deleted
                deleted = result.data.filter(function (item) { 
                    return (item.operator === 'delete' &&
                            (!item.status || // RUNNING
                             item.status.state === GroupState.FAILED));
                 
                }).map(function (item) {
                    return item.group;
                });
                
                self.logger_.debug('Groups being deleted, or failed to be ' +
                                   'deleted are: ' + 
                                   C.lang.reflect.inspect(deleted));
                
                // Assume the backend servers belongs to these groups are 
                // allocated
                // Calculate the unique numbers of the backend servers allocated
                // now
                allocated.forEach(function (group) {
                    group.backends.forEach(function (backend) {
                        if (!(backend in unique)) {
                            unique[backend] = true;
                            count += 1;
                        }
                    });
                });
                
                deleted.forEach(function (group) {
                    group.backends.forEach(function (backend) {
                        if (!(backend in unique)) {
                            unique[backend] = true;
                            count += 1;
                        }
                    });
                });
                
                logger.start('Checking again if the avaiable backend servers' +
                             ' are enough for scale ' + scale + 
                             ' after merging the ones being deleted');
                if (overall.length - count < needed) {
                    next(new C.caligula.errors.ResourceNotEnoughError(
                        'Scale ' + scale + ' requires at least ' + needed +
                        ' backend servers, but now at most ' + 
                        (overall.length - count) + ' are available'
                    ));
                    return;
                }
                
                logger.done();
                
                logger.start('Allocating ' + needed + 
                             ' backend servers for scale ' + scale);
                
                overall.some(function (backend) {
                    if (!(backend.name in unique)) {
                        backends.push(backend);
                        needed -= 1;
                    }
                    return needed === 0;
                });
                
                backends = backends.map(function (backend) {
                    return backend.name;
                });
                
                next(null, backends);
            }
        ], function (error, result) {
            if (error) {
                logger.error(error);
                callback(error);
                return;
            }
            
            logger.done(result);
            callback(null, result);
        });
    };
    
    
    /**
     * Lock the specified group and also the entire backend servers if required
     *
     * @method lockGroupAndBackends_
     * @param {Action} action the action trigger this locking
     * @param {String} property the property which owes the group
     * @param {String} name the group name to be locked
     * @param {Boolean} both whether the both group and backends are locked, or
     *                       only specified group is locked.
     * @param {Function} callback the callback function to be invoked after the
     *                            specified group and backends are locked
     *                            successfully, or some error occurs.
     *                            The signature of the callback function is
     *                            'function (error, locks) {}'
     */
    GroupHandler.prototype.lockGroupAndBackends_ = function (action, property, 
                                                             name, both, 
                                                             callback) {
        var self = this,
            logger = C.logging.getStepLogger(this.logger_),
            locks = {};
            
        C.async.waterfall([
            function (next) { // Lock the group
                logger.start('Acquiring the lock on on group ' + name);
                self.lock_(action, 'publishing.group.' + name, next);
            },
            function (result, next) { // Lock the backend
                logger.done(result);
                locks['publishing.group.' + name] = result;
                if (!both) {
                    next();
                    return;
                }

                logger.start('Acquiring the lock on the backend servers');
                self.lock_(action, 'publishing.backend.' + property, next);
            }
        ], function (error, result) {
            if (error) {
                logger.error(error);
                self.unlockGroupAndBackends_(action, locks, function () {
                    callback(error);
                });
                return;
            }
            
            if (both) {
                logger.done(result);
                locks['publishing.backend.' + property] = result;
            }
            
            callback(null, locks);
        });
    };
    
    /**
     * Unlock the pre-locked group and backend servers with the provided locking
     * info
     *
     * @method unlockGroupAndBackends_
     * @param {Action} action the action trigger this unlocking
     * @param {Object} locks the locks object obtained when locking
     * @param {Function} callback the callback function to be invoked after the
     *                            specified group and backends are unlocked
     *                            successfully, or some error occurs.
     *                            The signature of the callback function is
     *                            'function (error) {}'
     */
    GroupHandler.prototype.unlockGroupAndBackends_ = function (action, locks, 
                                                               callback) {
        var self = this,
            logger = C.logging.getStepLogger(this.logger_);
        
        this.logger_.debug('Unlocking the group and backend servers with ' +
                           'provided locking info: ' + 
                           C.lang.reflect.inspect(locks));
        
        if (!locks) {
            callback && callback();
            return;
        }                   
        C.async.forEachSeries(Object.keys(locks), function (name, next) {
            logger.done();
            logger.start('The pre-acquired lock "' + name + 
                         '" are to be released');
            self.unlock_(action, name, locks[name], next);
        }, function (error) {
            if (error) {
                logger.error(error);
            } else {
                logger.done();
            }
            callback && callback();
        });
    };
    
    
    /**
     * Update the configuration for the backends belong to the specified group
     *
     * @method updateBackends_
     * @param {Action} action the action trigger this update
     * @param {Object} group the group configurations for whose backends are
     *                       to be updated
     * @param {Array} backends the backend server list whose configuration are
     *                         to be updated
     * @param {Object} log the operation log object
     * @param {String} tag the tag name to be used for configuration generation
     * @param {Function} created the callback function to be invoked after the
     *                           notification of updating the configuration of
     *                           the backend servers of the specified group has
     *                           been successfully sent, or some error occurs.
     *                           The signature of the callback function is
     *                           'function (error, result) {}'
     * @param {Function} done the callback function to be invoked after the
     *                            orchestration job for updating the backend
     *                            servers of the specified group has
     *                            been completed.
     *                            The signature of the callback function is
     *                            'function (state) {}'
     */
    GroupHandler.prototype.updateBackends_ = function (action, group, backends, 
                                                       log, tag, created, done) {
        var self = this,
            logger = C.logging.getStepLogger(this.logger_),
            package = null;
        

        package = group.package || { name: 'trunk', version: 'latest' };
        logger.start('Creating orchestration job for publishing ' +
                     package.name + '@' + package.version + ' onto ' + 
                     group.backends.toString() + ' of group ' +
                     group.name);
        
        action.data = {
            nodes: backends,
            // TODO: make this command configurable
            command: self.command_,
            arguments: [tag],
            timeout: self.timeouts_.orchestration.backends,
            extras: {
                group: group.name, 
                operation: log.id, 
                affected: 'backends'
            }
        };

        action.acquire('orchestration.create', function (error, result) {
            var timer = null,
                id = null;
            
            if (error) {
                logger.error(error);
                created(error);
                return;
            }
            
            logger.done(result);
            created(null, result);
            
            if (!done) { // no done callback specified
                return;
            }
            
            id = result.id;
            timer = setInterval(function () { // periodically check stat of the
                                              // orchestration job
                action.data = { id: id };
                action.acquire('orchestration.stat', function (error, state) {
                    if (error || state.job === JobState.RUNNING) {
                        return;
                    }
                    
                    clearInterval(timer);
                    done(state);
                });
            }, self.timeouts_.timer); // every 5 sec
        });
    };
    
    
    /**
     * Update the configuration for the load balancers belong to the specified
     * isp
     *
     * @method updateLoadBalancers_
     * @param {Action} action the action trigger this update
     * @param {String} property the property that owns this group
     * @param {Object} group the group configurations for whose backends are
     *                       to be updated
     * @param {Object} log the operation log object
     * @param {String} tag the tag name to be used for configuration generation
     * @param {Function} callback the callback function to be invoked after the
     *                            notification of updating the configuration of
     *                            the backend servers of the specified group has
     *                            been successfully sent, or some error occurs.
     *                            The signature of the callback function is
     *                            'function (error) {}'
     */
    GroupHandler.prototype.updateLoadBalancers_ = function (action, property, 
                                                            group, log, 
                                                            tag, callback) {
        var self = this,
            logger = C.logging.getStepLogger(this.logger_);
            
        callback = callback || function () {};
        
        C.async.waterfall([
            function (next) { // Read load balancers belong to the ISP of the
                              // group
                logger.start('Reading load balancers for ISP ' + group.isp);
                action.data = { criteria: {
                    includes: { '$all': [
                        // TODO: replace 'weibo.mastersite' with action.data.property
                        'property.' + property + '.loadbalancer',
                        'isp.' + group.isp
                    ]},
                    type: 'node'
                }, fields: { name: 1 } };
                action.acquire('configuration.read', next);
            },
            function (result, unused, next) {
                var loadbalancers = null,
                    error = null;
                
                logger.done(result);
                if (0 === result.affected) {
                    error = new C.caligula.errors.LoadBalancerNotFoundError(
                        'Affected load balancers by group ' + group.name + 
                        ' can not be found'
                    );
                    self.logger_.error(error.message);
                    next(error);
                    return;
                }
                
                loadbalancers = result.data.map(function (loadbalancer) {
                    return loadbalancer.name;
                });
                // TODO: avoid load balancers being updated by two API calls
                //       at the same time
                logger.start('Creating orchestration job for updating ' +
                             'configurations of load balancers ' +
                             loadbalancers.toString());
                
                action.data = {
                    nodes: loadbalancers,
                    command: self.command_,
                    arguments: [tag],
                    timeout: self.timeouts_.orchestration.loadbalancers,
                    extras: {
                        group: group.name, 
                        operation: log.id, 
                        affected: 'loadbalancers'
                    }
                };
                action.acquire('orchestration.create', next);
            }
        ], function (error, result) {
            if (error) {
                logger.error(error);
                callback(error);
                return;
            }
            
            logger.done(result);
            callback();
        });
    };
    
    
    /**
     * Lock the entire operation log collection
     *
     * @method lock_
     * @param {Action} action the action which causes this collection lock
     * @param {Function} callback the callback function to be invoked after the
     *                            lock has been acquired successfully, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error, id) {}'
     */
    GroupHandler.prototype.lock_ = function(action, name, callback) {
        var params = action.data,
            self = this,
            logger = C.logging.getStepLogger(this.logger_);
        
        logger.start('Calling lock.acquire on "' + name + '"');
        
        action.data = {
            name: name,
            lease: this.timeouts_.lease
        };
        
        action.acquire('lock.acquire', function (error, result) {
            action.data = params;
            
            if (error) {
                logger.error(error);
                callback(error, null);
                return;
            }
            
            logger.done(result);
            callback(null, result);
        });
    };
    
    /**
     * Unlock the entire group operation log collection
     *
     * @method unlock_
     * @param {Action} action the action which requires this lock
     * @param {String} id the owner id of the lock currently hold
     * @param {Function} callback the callback function to be invoked after the
     *                            lock has been acquired successfully, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error) {}'
     */
    GroupHandler.prototype.unlock_ = function(action, name, id, callback) {
        var params = action.data,
            self = this,
            logger = C.logging.getStepLogger(this.logger_);
        
        logger.start('Calling lock.release on "' + name + '"');
        
        callback = callback || function () {};
        
        action.data = { name: name, owner: id };
        action.acquire('lock.release', function (error) {
            action.data = params;
            
            if (error) {
                logger.error(error);
                // callback(error, null);
                callback(); // It's safe not to report errors in unlock
                return;
            }
            
            logger.done();
            callback();
        });
    };
    
    C.namespace('caligula.handlers.publishing').GroupHandler = GroupHandler;



    /**
     * This type of error is to be thrown when the required group can not be
     * found.
     *
     * @class GroupNotFoundError
     * @constructor
     * @extends NotFoundError
     * @param {String} message the error message describe this error
     */
    function GroupNotFoundError (message) {
        /* inheritance */
        this.super(3, message);
    }
    C.lang.inherit(GroupNotFoundError, C.caligula.errors.NotFoundError);

    C.namespace('caligula.errors').GroupNotFoundError = GroupNotFoundError;

    /**
     * This type of error is designed to be thrown when one operation is to be
     * applied on the specified group, but another one is operating the group
     * at the same time.
     *
     * @class OperationConflictError
     * @constructor
     * @extends ConflictError
     * @param {String} message  the error message
     */
    function OperationConflictError (message) {
        /* inheritance */
        this.super(1, message);
    }
    C.lang.inherit(OperationConflictError, C.caligula.errors.ConflictError);

    C.namespace('caligula.errors').OperationConflictError = OperationConflictError;

    /**
     * This type of error is designed to be thrown when the group was failed 
     * to be deleted. In this scenario, no operations are allowd to be applied
     * onto this group, except 'delete' until the group is successfully deleted.
     *
     * @class GroupGoneError
     * @constructor
     * @extends GoneError
     * @param {String} message the error message
     */
    function GroupGoneError (message) {
        /* inheritance */
        this.super(1, message);
    }
    C.lang.inherit(GroupGoneError, C.caligula.errors.GoneError);

    C.namespace('caligula.errors').GroupGoneError = GroupGoneError;

    /**
     * This type of error is designed to be thrown when the group to be created
     * already exist.
     *
     * @class GroupAlreadyExistError
     * @constructor
     * @extends ConflictError
     * @param {String} message the error message
     */
    function GroupAlreadyExistError (message) {
        /* inheritance */
        this.super(2, message);
    }
    C.lang.inherit(GroupAlreadyExistError, C.caligula.errors.ConflictError);
    C.namespace('caligula.errors').GroupAlreadyExistError = GroupAlreadyExistError;

    /**
     * This type of error is designed to be thrown when the required resources
     * for the new group or scaled group are not enough.
     *
     * @class ResourceNotEnoughError
     * @constructor
     * @extends RequestedRangeNotSatisfiableError
     * @param {String} message the error message
     */
    function ResourceNotEnoughError (message) {
        /* inheritance */
        this.super(1, message);
    }
    C.lang.inherit(ResourceNotEnoughError, C.caligula.errors.RequestedRangeNotSatisfiableError);
    C.namespace('caligula.errors').ResourceNotEnoughError = ResourceNotEnoughError;

}, '0.0.1', { requires: [
    'caligula.handlers.base', 
    'caligula.components.orchestration.base'
] });
