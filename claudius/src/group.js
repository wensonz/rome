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
            owner = null,
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
                self.lock_(action, next);
            },
            function (result, next) { // Query the current status
                logger.done(result);
                owner = result;
                
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

                logger.start('Creating orchestration job for publishing ' +
                             params.package.name + '@' + 
                             params.package.version + ' onto ' + 
                             group.backends.toString() + ' of group ' +
                             params.name);
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
                self.unlock_(action, owner, cleanup);
                return;
            }
            
            cleanup();
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
            allocated = {},
            nodes = null,
            locks = {},
            group = null,
            logger = C.logging.getStepLogger(this.logger_);

        C.async.waterfall([
            function (next) { // Lock the group
                logger.start('Acquiring the lock on on group ' + params.name);
                self.lock_(action, 'publishing.group.' + params.name, next);
            },
            function (result, next) { // Lock the backend
                logger.done(result);
                locks.group = result;

                logger.start('Acquiring the lock on the backend servers');
                self.lock_(action, 'publishing.backend', next);
            },
            function (result, next) { // Check if group already exist
                logger.done(result);
                locks.backend = result;

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
                
                logger.start('Reading all groups belong to ISP ' + params.isp);
                action.data = { 
                    criteria: { isp: params.isp }, 
                    fields: { backends: 1 }
                };
                action.acquire('data.publishing.group.read', next);
            },
            function (result, unused, next) { // Read all backend servers belong
                                              // to the specified ISP
                logger.done(result);
                result.data = result.data || [];
                result.data.forEach(function (item) {
                    item.backends.forEach(function (backend) {
                        allocated[backend] = true;
                    });
                });

                logger.start('Reading all backend servers belong to ISP ' +
                             params.isp);
                
                action.data = { criteria: { 
                    includes: [
                        'property.weibo.master-site.variants',
                        'isp.' + params.isp
                    ],
                    type: 'node'
                }, fields: { name: 1 } };

                action.acquire('configuration.read', next);
            },
            function (result, unused, next) { // Read deleting oeprations 
                logger.done(result);
                nodes = result.data || [];
                
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
                var groups = null,
                    backends = {},
                    available = null,
                    required = 0;
                
                logger.done(result);
                
                result.data = result.data || [];
                // find out the groups that are being deleted or failed to be
                // deleted
                groups = result.data.filter(function (item) { 
                    return (item.operator === 'delete' &&
                            (!item.status || 
                             item.status.state === GroupState.FAILED));
                             
                }).map(function (item) {
                    return item.group;
                });
                
                self.logger_.debug('Groups being or has been deleted are: ' +
                                   C.lang.reflect.inspect(groups));
                
                
                groups.forEach(function (group) {
                    group.backends.forEach(function (backend) {
                        allocated[backend] = true;
                    }); 
                });
                
                available = nodes.filter(function (node) {
                    return !(node.name in allocated);
                }).map(function (node) {
                    return node.name;
                });
                
                logger.start('Verifying the available resources for ' + 
                             params.scale + '% for group ' + params.name);
                // Note that now only 10% of the overall traffic is allowd to 
                // be redirected to the branched testing groups, so the 
                // calculation is based on 10 and nodes participated in the
                // testing.
                // Note: now that there are only 2 ISPs supported, CNC and CT
                //       and the resources are deployed in two IDCs equally,
                //       so the scale are divided by 5, which means all
                //       resources of one ISP are to be allocated if user
                //       specifies the scale to be 5
                required = Math.ceil(nodes.length * params.scale / 5);
                if (available.length < required) {
                    next(new C.caligula.errors.ResourceNotEnoughError(
                        'Required scale ' + params.scale + '% for group ' +
                        params.name + ' needs at least ' + required + 
                        ', but only ' + available.length + ' are available'
                    ));
                    return;
                }
                
                params.backends = available.slice(0, required);
                logger.done(params.backends);
                
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
            
            C.async.forEachSeries(Object.keys(locks), function (name, next) {
                self.logger_.debug('The pre-acquired ' + name + ' lock ' +
                                   'for group ' + params.name + 
                                   ' are to be released');
                self.unlock_(action, locks[name], next);
            }, function () {
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
     * Scale the size of the backend servers of the specified group
     *
     * @method scale
     * @param {Action} action the scaling action to be handled
     */
    GroupHandler.prototype.scale = function (action) {
        var params = action.data,
            self = this,
            locks = {},
            logger = C.logging.getStepLogger(this.logger_);
        
        C.async.waterfall([
            function (next) { // Lock the group
                logger.start('Acquiring the lock on on group ' + params.name);
                self.lock_(action, 'publishing.group.' + params.name, next);
            },
            function (result, next) { // Lock the backend
                logger.done(result);
                locks.group = result;

                logger.start('Acquiring the lock on the backend servers');
                self.lock_(action, 'publishing.backend', next);
            },
            function (result, next) { // Read current status of the group
                logger.done(result);
                locks.backend = result;
                
                logger.start('Querying the current status of the group ' +
                             params.name);
                action.data = { name: params.name };
                action.acquire(action.name.replace(/scale$/, 'status'), next);
            },
            function (status, next) { // Calculate the scale
                //
            }
        ], function (error, result) {
            //
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
                self.lock_(action, next);
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
                self.unlock_(action, owner, cleanup);
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
