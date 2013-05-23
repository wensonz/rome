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
            function (result, next) { // Read the group data
                logger.done(result);
                locked = result.acquired;
                
                logger.start('Reading the details of the group ' + params.name);
                action.data = { name: params.name };
                action.acquire('data.publishing.group.read', next);
            },
            function (result, next) { // Read the most recent operation log
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
            function (result, next) { // Read the orchestration job data
                logger.done(result);
                
                if (0 === result.affected) {
                    next();
                    return;
                }
                
                log = result.data[0];
                
                logger.start('Reading the orchestration job for operation ' +
                             log.id + ' of group ' + params.name);
                //
                action.data = { 'extras': {
                    group: params.name,
                    operation: log.id
                }};
                action.acquire('orchestration.read', next);
            },
            function (result, next) {
                
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
                    
                    if (log.operator !== 'delete') {
                        next(new C.caligula.errors.InternalServerError(
                            'A "delete" operation is expected since the group ' +
                            params.name + ' does not exist, but a "' + 
                            log.operator + '" operation is found'
                        ));
                        return;
                    }
                    
                    group = log.group;
                }
                
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
                
                //
                status.details = {};
                jobs.forEach(function (job, index) {
                    var detail = {},
                        nodes = null;
                    
                    status.details[job.extras.category] = detail;
                    
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
            self = this
            logger = C.caligula.logging.getStepLogger(this.logger_);
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
    GroupHandler.prototype.lock_ = function(action, callback) {
        var params = action.data,
            self = this,
            logger = C.caligula.logging.getStepLogger(this.logger_);
        
        logger.start('Calling lock.acquire on "publishing.group.' + 
                     params.name + '"');
        
        action.data = { 
            name: 'publishing.group.' + params.name, 
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
    GroupHandler.prototype.unlock_ = function(action, id, callback) {
        var params = action.data,
            self = this,
            logger = C.caligula.logging.getStepLogger(this.logger_);
        
        logger.start('Calling lock.release on "publishing.group.' + 
                     params.name + '"');
        
        action.data = { name: 'publishing.group.' + params.name, owner: id };
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
        // TODO: 1. lock the operation
        //       2. call status to find the current status of the group
        //       3. add the operation log if no other operation is in processing
        
        var self = this,
            params = action.data,
            logger = C.caligula.logging.getStepLogger(this.logger_),
            lock = null;
        
        C.async.waterfall([
            function (next) { // lock the operation collection
                logger.start('Acquiring the operation lock';
                self.logger_.debug(message + ' ...');
                self.lock_(action, next);
            },
            function (id, next) { // call status
                var index = null;
                
                self.logger_.debug(message + ' succeed.');
                lock = id;
                
                message = 'Querying group status to find if there is an ' +
                          'operation on going';
                self.logger_.debug(message + ' ...');
                action.data = params;
                index = action.name.lastIndexOf('.');
                // TODO: check if index < 0
                //       would it be better using split and join?
                action.acquire(action.name.substring(0, index + 1) + 'status', 
                               next);
            },
            function (result, next) {
                self.logger_.debug(message + ' succeed. Status: ' +
                                   C.lang.reflect.inspect(result));
                
                message = 'Ensuring that there is no other operation on going' +
                          ' on the specified group "' + params.name + '"';
                self.logger_.debug(message + ' ...');
                if (result.state === C.caligula.constants.State.CHANGING) {
                    next(new C.caligula.errors.OperationConflictError(
                        'There is already a "' + result.operation + 
                        '" operation on the required group "' + params.name + 
                        '"'
                    ));
                    return;
                }
                
                self.logger_.debug(message + ' succeed.');
                
                message = 'Creating the operation log for this "' + operation +
                          '" operation on the specified group "' + params.name +
                          '"';
                self.logger_.debug(message + ' ...');
                action.data = {
                    id: C.uuid.v4(),
                    group: group, // the current group object backup
                    operation: operation,
                    params: params,
                    revisions: {},
                    timestamp: Date.now()
                };
                
                action.acquire('data.publishing.group.operation.create', next);
            }
        ], function (error, result) {
            
            var cleanup = function () {
                if (error) {
                    self.logger_.error(message + ' failed. Error: ' +
                                       C.lang.reflect.inspect(error));
                    callback(error, null);
                    return;
                }
                
                self.logger_.debug(message + ' succeed.');
                callback(null, action.data); // Return the log object itself
            };
            
            if (lock) {
                self.logger_.debug('Release the pre-acquired operation lock ' + 
                                   lock + ' ...');
                self.unlock_(action, lock, cleanup);
                return;
            }
            
            cleanup();
        });
    };
    
    C.namespace('caligula.handlers').GroupHandler = GroupHandler;

}, '0.0.1', { requires: ['caligula.handlers.base', 'caligula.logging'] });