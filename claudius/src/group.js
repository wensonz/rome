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
    
    /**
     * This GroupHandler class is a child class of Handler, and designed to
     * handle the group related actions, such as create, update, and publish
     * etc.
     * 
     * @class GroupHandler
     * @constructor
     * @extends Handler
     */
    function GroupHandler () {
        /* inheritance */
        this.super();
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
                    next(null, { acquired: true });
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
                    'extras': {
                        group: params.name,
                        operation: log.id
                    }
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
                
                if (!jobs) { // orchestration job not created
                    status.state = locked ? GroupState.RUNNING : 
                                            GroupState.FAILED;
                    next(null, status);
                    return;
                }
                
                // search for the minimum job state
                status.state = result.reduce(function (min, current) { 
                    return Math.min(min, current.job);
                }, JobState.RUNNING);
                
                status.state = status.state % 2; // translate to GroupState
                if ((status.state === GroupState.DONE) && 
                    (status.operator === 'delete')) {
                    next(new C.caligula.errors.GroupNotFoundError(
                        'Required group ' + params.name + ' does not exist'
                    ));
                }
                
                //
                status.details = {};
                jobs.forEach(function (job, index) {
                    var nodes = result[index].nodes;
                    
                    status.details[job.extras.affected] = nodes;
                    if (failed) {
                        return;
                    }
                    failed = nodes.some(function (node) {
                        return node.error && node.error.code !== 40800;
                    });
                });
                
                if ((status.state === GroupState.DONE) && failed) {
                    status.state = GroupState.FAILED;
                }
                
                next(null, status);
            },
            function (status, next) {
                if (status.state === GroupState.RUNNING) {
                    next(null, status);
                    return;
                }
                
                logger.done(status);
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
                    }
                );
                
                next(null, status);
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
            
            // logger.done(status);
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
                self.lockGroupAndBackends_(action, params.name, false, next);
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
                    timestamp: Date.now()
                };

                action.data = log;
                action.acquire('data.publishing.group.operation.create', next);
            },
            function (result, unused, next) { // Update the group data
                logger.done(result);

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
                logger.done(result);

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
                             
                self.updateGroupBackendsConfiguration_(action, group, 
                                                       group.backends, log, tag, 
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
            logger = C.logging.getStepLogger(this.logger_);

        C.async.waterfall([
            function (next) { // Lock the group and backends
                logger.start('Acquiring the lock on on group ' + params.name +
                             ' and backends for resource allocation');
                self.lockGroupAndBackends_(action, params.name, true, next);
                // self.lock_(action, 'publishing.group.' + params.name, next);
            },
            function (result, next) { // Check if group already exist
                logger.done(result);
                // locks['publishing.backend'] = result;
                // locks.backend = result;
                locks = result;
                
                logger.start('Seaching the existing groups for name ' + 
                             params.name);
                
                action.data = { criteria: { name: params.name }};
                action.acquire('data.publishing.group.read', next);
            },
            function (result, unused, next) { // Read all groups belong to the
                                              // specified ISP
                logger.done(result);

                logger.start('Ensuring the group ' + params.name + 
                             ' does not exist');
                if (result.affected > 0) {
                    next(new C.caligula.errors.GroupAlreadyExistError(
                        'Group ' + params.name + ' already exists.'
                    ));
                    return;
                }

                logger.done();
                
                logger.start('Trying to allocate backend servers of ISP ' +
                             params.isp + ' at scale ' + params.scale);
                
                self.allocateBackends_(action, params.isp, params.scale, next);
            },
            function (result, next) { // create operation log
                var groups = null,
                    backends = {},
                    available = null,
                    required = 0;
                
                logger.done(result);
                params.backends = result;
                
                action.data = {
                    id: C.uuid.v4(),
                    operator: 'create',
                    params: params,
                    timestamp: Date.now(),
                    group: params
                };
                logger.start('Creating the operation log for creating group ' +
                             params.name + ' with params: ' +
                             C.lang.reflect.inspect(action.data));
                action.acquire('data.publishing.group.operation.create', next);
            },
            function (result, unused, next) {
                logger.done(result);
                
                logger.start('Creating the data object for group ' + 
                             params.name);
                action.data = params;
                action.acquire('data.publishing.group.create', next);
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
            logger = C.logging.getStepLogger(this.logger_);
        
        C.async.waterfall([
            function (next) { // Lock the group and backends
                logger.start('Acquiring the lock on on group ' + params.name +
                             ' and backends for resource allocation');
                self.lockGroupAndBackends_(action, params.name, true, next);
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
                difference = group.scale - params.scale;

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
                
                self.allocateBackends_(action, group.isp, difference, next);
            },
            function (result, next) { // create operation log
                var count = 0;
                
                if (result) {
                    logger.done(result);
                    // params.backends === allocated backends after scaling
                    params.backends = group.backends.concat(result);
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
                    timestamp: Date.now()
                };

                action.data = log;
                action.acquire('data.publishing.group.operation.create', next);
            },
            function (result, unused, next) { // update the group
                logger.done(result);
                
                action.data = {
                    criteria: { name: params.name },
                    update: { '$set': {
                        scale: params.scale
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
                    self.logger_('Scaling group ' + group.name + 
                                 ' in for scale ' + params.scale + 
                                 ', no backend configuration updates needed');
                    next(null, null);
                    return;
                }
                
                logger.start('Sending notification to update the package on ' +
                             'new allocated backends ' + 
                             params.backends.toString() + ' of group ' + 
                             params.name);
                             
                self.updateGroupBackendsConfiguration_(
                    action, group, params.backends, log, tag, next, 
                    function (state) {
                        var failed = state.nodes.some(function (node) {
                            var result = node.result;
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
                         
                        self.updateLoadBalancerConfiguration_(action, group, 
                                                              log, tag);
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
                         
                self.updateLoadBalancerConfiguration_(action, group, log, 
                                                      tag, next);
            }
        ], function (error, result) {
            if (error) {
                if (error instanceof C.caligula.errors.FoundRedirection) {
                    self.logger_.debug('No change happened to the group ' +
                                       group.name + ' due to the same scale ' +
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
            owner = null,
            group = null,
            log = null;

        C.async.waterfall([
            function (next) { // Lock the operation log 
                logger.start('Acquiring the operation lock for group ' +
                             params.name);
                self.lock_(action, 'publish.group.' + params.name, next);
            },
            function (result, next) { // Query the current status
                logger.done(result);
                owner = result;
                
                logger.start('Querying current status of group ' + params.name);
                action.data.internal = true;
                action.acquire(action.name.replace(/publish$/, 'status'), next);
            },
            function (status, unused, next) { // Create an operation log

                logger.done(status);
                
                logger.start('Checking if the group ' + params.name + 
                             ' is available for ' + 
                             (params.pause ? 'pausing' : 'resuming'));

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
                    timestamp: Date.now()
                };

                action.data = log;
                action.acquire('data.publishing.group.operation.create', next);
            },
            function (result, unused, next) { // Update the group data
                logger.done(result);

                action.data = {
                    criteria: { name: params.name },
                    update: { '$set': {
                        package: params.package
                    }}
                };
                logger.start('Updating the group ' + params.name +
                             ' to be ' + params.pause ? 'paused' : 'resumed');

                action.acquire('data.publishing.group.update', next);
            },
            function (result, unused, next) { // Creat orchestration job
                logger.done(result);

                logger.start('Creating orchestration job for ' +
                             (params.pause ? 'pausing' : 'resuming') +
                             'backends ' + group.backends.toString() + 
                             ' of group ' + params.name);
                action.data = {
                    nodes: group.backends,
                    command: '/usr/local/sinasrv2/sbin/rome-claudius-pause',
                    arguments: [params.pause],
                    timeout: 120, // 2 min
                    extras: { 
                        group: group.name, 
                        operation: log.id, 
                        affected: 'backends'
                    }
                };
                action.acquire('orchestration.create', next);
            }
        ], function (error, result) {
            var cleanup = function () {
                if (error) {
                    logger.error(error);
                    action.error(error);
                    return;
                }

                logger.done(result);
                action.done();
            };
            
            if (owner) {
                self.logger_.debug('Release the pre-acquired operation lock ' +
                                   'for group ' + params.name + ' ...');
                self.unlock_(action, 'publishing.group.' + params.name, owner, 
                             cleanup);
                return;
            }
            
            cleanup();
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
    GroupHandler.prototype.allocateBackends_ = function (action, isp, scale, callback) {
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
                        'property.weibo.master-site.variants',
                        'isp.' + isp
                    ]},
                    type: 'node'
                }, fields: { name: 1 } };
                
                action.acquire('configuration.read', next);
            },
            function (result, unused, next) { // Read groups belongs to the
                                              // specified ISP
                
                logger.done(result);
                overall = result.data;
                // Note that now only 10% of the overall traffic is allowd to 
                // be redirected to the branched testing groups, so the 
                // calculation is based on 10 and nodes participated in the
                // testing.
                // Note: now that there are only 2 ISPs supported, CNC and CT
                //       and the resources are deployed in two IDCs equally,
                //       so the scale are divided by 5, which means all
                //       resources of one ISP are to be allocated if user
                //       specifies the scale to be 5
                needed = Math.ceil(overall.length * scale / 5);
                
                logger.start('Reading all groups belong to ISP ' + isp);
                action.data = { 
                    criteria: { isp: isp }, 
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
                
                /*
                count = result.data.length;
                result.data.forEach(function (item) {
                    item.backends.forEach(function (backend) {
                        allocated[backend] = true;
                    });
                });
                */
                
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
                
                next(backends);
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
     * @param {String} name the group name to be locked
     * @param {Boolean} both whether the both group and backends are locked, or
     *                       only specified group is locked.
     * @param {Function} callback the callback function to be invoked after the
     *                            specified group and backends are locked
     *                            successfully, or some error occurs.
     *                            The signature of the callback function is
     *                            'function (error, locks) {}'
     */
    GroupHandler.prototype.lockGroupAndBackends_ = function (action, name, both, callback) {
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
                // locks.group = result;

                logger.start('Acquiring the lock on the backend servers');
                self.lock_(action, 'publishing.backend', next);
            }
        ], function (error, result) {
            if (error) {
                logger.error(error);
                self.unlockGroupAndBackends_(action, locks, function () {
                    callback(error);
                });
                return;
            }
            
            logger.done(result);
            locks['publishing.backend'] = result;
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
    GroupHandler.prototype.unlockGroupAndBackends_ = function (action, locks, callback) {
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
     * @method updateGroupBackendsConfiguration_
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
    GroupHandler.prototype.updateGroupBackendsConfiguration_ = function (action, group, backends, log, tag, created, done) {
        var self = this,
            logger = C.logging.getStepLogger(this.logger_);
        
        logger.start('Creating orchestration job for publishing ' +
                     group.package.name + '@' + 
                     group.package.version + ' onto ' + 
                     group.backends.toString() + ' of group ' +
                     group.name);
        
        action.data = {
            nodes: group.backends,
            command: '/usr/local/sinasrv2/sbin/rome-config-sync',
            arguments: [tag],
            timeout: 120 * 1000, // 120 sec
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
            timer = setInterval(function () {
                action.data = { id: id };
                action.acquire('orchestration.stat', function (error, state) {
                    if (error || state.job === JobState.RUNNING) {
                        return;
                    }
                    
                    clearInterval(timer);
                    done(state);
                });
            }, 5000); // every 5 sec
        });
    };
    
    
    /**
     * Update the configuration for the load balancers belong to the specified
     * isp
     *
     * @method updateLoadBalancerConfiguration_
     * @param {Action} action the action trigger this update
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
    GroupHandler.prototype.updateLoadBalancerConfiguration_ = function (action, group, log, tag, callback) {
        var self = this,
            logger = C.logging.getStepLogger(this.logger_);
            
        callback = callback || function () {};
        
        C.async.waterfall([
            function (next) { // Read load balancers belong to the ISP of the
                              // group
                logger.start('Reading load balancers for ISP ' + group.isp);
                action.data = { criteria: {
                    includes: { '$all': [
                        'property.weibo.mastersite.loadbalancer',
                        'isp.' + group.isp
                    ]},
                    type: 'node'
                }, fields: { name: 1 } };
                action.acquire('configuration.read', next);
            },
            function (result, unused, next) {
                var loadbalancers = null;
                
                logger.done(result);
                
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
                    command: '/usr/local/sinasrv2/sbin/rome-config-sync',
                    arguments: [tag],
                    timeout: 120 * 1000, // 120 sec
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
            lease: 5000 // max lifespan for a lock
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
