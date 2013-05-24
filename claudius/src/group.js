/**
 * This module contains the version 2 implementation of the group-based 
 * publishing APIs for Weibo master site.
 * 
 * @module caligula.components.publishing.group
 */
Condotti.add('caligula.components.publishing.group', function (C) {
    
    var State = {
        DONE: 0,
        FAILED: 1,
        RUNNING: 2
    };
    
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
            logger = C.caligula.logging.getStepLogger(this.logger_);
            
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
            function (result, unused, next) { // Read the most recent operation log
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
                    next();
                    return;
                }
                
                log = result.data[0];
                
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
                
                if (C.lang.reflect.isFunction(result)) {
                    next = result;
                    next();
                    return;
                }
                
                logger.done(result);
                
                if (0 === result.affected) {
                    next();
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
                
                if (C.lang.reflect.isFunction(result)) {
                    next = result;
                    result = undefined;
                } else {
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
                            state: State.FAILED,
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
                    status.state = locked ? State.RUNNING : State.FAILED;
                    next(null, status);
                    return;
                }
                
                // search for the minimum job state
                status.state = result.reduce(function (min, current) { 
                    return Math.min(min, current.job);
                }, 2);
                
                status.state = (status.state + 1) % 3; // translate to State
                if ((status.state === State.DONE) && 
                    (status.operator === 'delete')) {
                    next(new C.caligula.errors.GroupNotFoundError(
                    ));
                }

                //
                status.details = {};
                jobs.forEach(function (job, index) {
                    var detail = {},
                        nodes = null;
                    
                    status.details[job.extras.affected] = detail;
                    
                    result[index].nodes.forEach(function (node) {
                        detail[node.node] = { state: node.stat };
                        if (!failed && node.stat > 4) {
                            failed = true;
                        }
                    });
                });
                
                if ((status.state === State.DONE) && failed) {
                    status.state = State.FAILED;
                }
                
                next(null, status);
            }
            // TODO: save status into log if DONE/FAILED
        ], function (error, result) {
            if (error) {
                logger.error(error);
                action.error(error);
                return;
            }
            
            logger.done(status);
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
            logger = C.caligula.logging.getStepLogger(this.logger_),
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
                action.data.internal = true;
                action.acquire(action.name.replace(/publish$/, 'status'), next);
            },
            function (status, unused, next) { // Create an operation log

                logger.done(status);
                
                logger.start('Checking if the group ' + params.name + 
                             ' is available for new publishing');

                if (status.state === State.RUNNING) {
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

                tag = 'TAG_PUBLISHING_GROUP_' + params.name.toUpperCase() + 
                      '@' + Date.now().toString();

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
                    command: '',
                    parameters: [tag],
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
            locks = {},
            logger = C.logging.getStepLogger(this.logger_);

        C.async.waterfall([
            function (next) { // Lock the group
                logger.start('Acquiring the lock on on group ' + params.name);
                self.lock_(action, 'publishing.group.' + params.name, next);
            },
            function (result, next) { // Lock the backend
                logger.done(result);
                locks.group = result.owner;

                logger.start('Acquiring the lock on the backend servers');
                self.lock_(action, 'publishing.backend', next);
            },
            function (result, next) { // Check if group already exist
                logger.done(result);
                locks.backend = result.owner;

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
            function (result, unused, next) { //
                logger.done(result);
                //
            }
        ], function (error, result) {
            //
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
            logger = C.caligula.logging.getStepLogger(this.logger_);
        
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
            logger = C.caligula.logging.getStepLogger(this.logger_);
        
        logger.start('Calling lock.release on "' + name + '"');
        
        action.data = { name: name, owner: id };
        action.acquire('lock.release', function (error) {
            action.data = params;
            
            if (error) {
                logger.error(error);
                callback(error, null);
                return;
            }
            
            logger.done();
            callback();
        });
    };
    
    /**
     * Create an operation log based on the incoming request. Please refer to
     * TODO: shorten it
     * http://wiki.intra.sina.com.cn/display/dpool/Claudius+-+Group-based+Publishing+APIs+for+Weibo+front-end+Version2#Claudius-Group-basedPublishingAPIsforWeibofront-endVersion2-DataStructures
     * for the data structure of the operation log.
     * 
     * @method createOperationLog_
     * @param {Action} action the incoming action which causes this operation
     *                        log to be created
     * @param {Object} group the group object to be operated on
     * @param {String} operation the operation to be executed, such as publish.
     * @param {Function} callback the callback function to be invoked when the
     *                            required operation log has been successfully
     *                            created, or some error occurs. The signature
     *                            of the callback is 'function (error, log)'
     */
    GroupHandler.prototype.createOperationLog_ = function (action, group,
                                                           operation, callback) {
        //
    };
    
    C.namespace('caligula.handlers').GroupHandler = GroupHandler;

}, '0.0.1', { requires: ['caligula.handlers.base', 'caligula.logging'] });
