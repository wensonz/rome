/**
 * This module contains the version 2 implementation of the group-based 
 * publishing APIs for Weibo master site.
 * 
 * TODO: refactor the component namespace to remove the dependency of "caligula"
 * 
 * @module caligula.components.publishing.group
 */
Condotti.add('caligula.components.publishing.group', function (C) {

    /**
     * This GroupHandler class is a child class of Handler, and designed to
     * handle the group related actions, such as create, update, and publish
     * etc.
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
        this.config_ = config;
    }
    
    C.lang.inherit(GroupHandler, C.caligula.handlers.Handler);
    
    /**
     * Return the current status of the user specified group
     * 
     * @method status
     * @param {Action} action the action to query current status of the group
     */
    GroupHandler.prototype.status = function (action) {
        // TODO: 
        //      1. Read group object
        //      2. Read latest operation log
        //      3. Read orchestration job
        //      4. Construct the status object
        
        var self = this,
            params = action.data,
            log = null,
            status = null,
            logger = new C.caligula.utils.logging.StepLogger(this.logger_);
        
        C.async.waterfall([
            function (next) { // Read the group object
                logger.start('Reading the group details for ' + params.name);
                action.data = { criteria: { name: params.name } };
                action.acquire('data.publishing.group.read', next);
            },
            function (result, next) { // Read the most recent operation log
                logger.done(result);
                
                logger.start('Reading the most recent operation log for group ' +
                             params.name);
                action.data = { 
                    criteria: { group: params.name },
                    operations: {
                        sort: { timestamp: -1 },
                        limit: 1
                    }
                };
                action.acquire('data.publishing.group.operation.read', next);
            },
            
        ], function(error, result) {
            //
        });
    };
    
    /**
     * Publish a new version of package of the master site. Note that the 
     * specified package is required to be released first via the ROME package
     * management APIs.
     * 
     * @method publish
     * @param {Action} action the publishing action to be handled
     */
    GroupHandler.prototype.publish = function (action) {
        // TODO: 0. check if the package exist
        //       1. check current group state to be OK or FAIL
        //       2. check there is no operation in process now
        //       3. create operation log (contains 1 and 2)
        //       4. update group data, operation, package, state, etc
        //       5. create orchestration
        //       6. update operation log with the orchestration job id
        
        var self = this,
            params = action.data,
            message = null,
            package = null,
            group = null,
            log = null;
        
        C.async.waterfall([
            function (next) { // Read the group info
                message = 'Reading the related group info for ' + params.name;
                self.logger_.debug(message + ' ...');
                action.data = { name: params.name };
                action.acquire('data.publishing.group.read', next);
            },
            function (result, next) { // Read the infomation about the package
                self.logger_.debug(message + ' succeed. Result: ' +
                                   C.lang.reflect.inspect(result));
                
                message = 'Verifying the group ' + params.name + ' exist';
                self.logger_.debug(message + ' ...');
                
                if (0 === result.affected) {
                    next(new C.caligula.errors.GroupNotFoundError(
                        'Required group ' + params.name + ' does not exist'
                    ));
                    return;
                }
                self.logger_.debug(message + ' succeed.');
                group = result.data[0];
                
                message = 'Reading the package info for ' + 
                          params.package.name + '@' + params.package.version;
                self.logger_.debug(message + ' ...');
                
                action.data = { criteria: params.package };
                action.acquire('package.read', next);
            },
            function (result, next) { // Create the operation log
                self.logger_.debug(message + ' succeed. Result: ' +
                                   C.lang.reflect.inspect(result));
                
                message = 'Verifying the package ' + params.package.name + '@' +
                          params.package.version + ' exist';
                self.logger_.debug(message + ' ...');
                
                if (0 === result.affected) {
                    next(new C.caligula.errors.PackageNotFoundError(
                        'Required package ' + params.package.name + '@' +
                        params.package.version + ' does not exist'
                    ));
                    return;
                }
                
                self.logger_.debug(message + ' succeed.');
                package = result.data[0];
                
                message = 'Creating operation log for this publish action ' +
                          'with params: ' + C.lang.reflect.inspect(params);
                self.logger_.debug(message + ' ...');
                self.createOperationLog_(action, 'publish', next);
            },
            function (result, next) { // Update the group data
                self.logger_.debug(message + ' succeed. Result: ' +
                                   C.lang.reflect.inspect(result));
                
                log = result;
                group.state = C.caligula.constants.State.CHANGING;
                group.operation = log.id;
                group.package = params.package;
                
                action.data = {
                    criteria: { name: params.name },
                    update: group
                };
                
                message = 'Updating the group ' + params.name + 
                          ' with params: ' + C.lang.reflect.inspect(action.data);
                self.logger_.debug(message + ' ...');
                
                action.acquire('data.publishing.group.update', next);
            },
            function (result, next) { // Deployment
                self.logger_.debug(message + ' succeed. Result: ' +
                                   C.lang.reflect.inspect(result));
                // TODO: double check the affected number is 1
                
                message = 'Updating the configuration changes on the ' +
                          'affected backend servers: ' + 
                          group.backends.toString();
                self.logger_.debug(message + ' ...');
                self.deploy_(action, group.backends, log, next);
            }
        ], function(error, result) {
            if (error) {
                self.logger_.error(message + ' failed. Error: ' +
                                   C.lang.reflect.inspect(error));
                action.error(error);
                return;
            }
            
            self.logger_.debug(message + ' succeed.');
            action.done();
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
    GroupHandler.prototype.lock_ = function(action, callback) {
        var params = action.data,
            self = this,
            message = null;

        message = 'Calling lock.acquire on \'publishing.group.operation\'';
        this.logger_.debug(message + ' ...');

        action.data = { name: 'publishing.group.operation', lease: 5000 }; // max lifespan for a lock
        action.acquire('lock.acquire', function (error, result) {
            action.data = params;
            
            if (error) {
                self.logger_.debug(message + ' failed. Error: ' + 
                                   C.lang.reflect.inspect(error));
                callback(error, null);
                return;
            }
            
            self.logger_.debug(message + ' succeed. Owner id: ' + result);
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
            message = null;
        
        message = 'Calling lock.release on \'publishing.group.operation\'';
        this.logger_.debug(message + ' ...');
        
        action.data = { name: 'publishing.group.operation', owner: id };
        action.acquire('lock.release', function (error) {
            action.data = params;
            
            if (error) {
                self.logger_.debug(message + ' failed. Error: ' + 
                                   C.lang.reflect.inspect(error));
                callback(error, null);
                return;
            }
            
            self.logger_.debug(message + ' succeed.');
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
            message = null,
            lock = null;
        
        C.async.waterfall([
            function (next) { // lock the operation collection
                message = 'Acquiring the operation lock';
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
    
    
    /**
     * Create a deployment(orchestration) job to trigger the configuration
     * update on the specified nodes(servers).
     * 
     * @method deploy_
     * @param {Action} action the action causes this deployment
     * @param {Array} targets the target nodes whose configuration are to be
     *                        deployed
     * @param {Object} log the log of the operation which causes this
     *                     deployment
     * @param {Function} callback the callback function to be invoked when the
     *                            deployment job has been successfully created, 
     *                            or some error occurs. The signature
     *                            of the callback is 'function (error, job)'
     */
    GroupHandler.prototype.deploy_ = function (action, targets, log, callback) {
        var self = this,
            message = null,
            params = action.data;
        
        // TODO: -1. create TAG = Moved to the caller, since this method can not
        //                        determine if the nginx and backends are 
        //                        affected
        //       2. create orchestration job
        //       3. update the operation log
        
        action.data = {
            nodes: targets,
            command: '',
            parameters: [],
            timeout: 120, // 2 min
            extras: { group: params.name, operation: log.id }
        };
        message = 'Creating orchestration job with params: ' +
                  C.lang.reflect.inspect(action.data);
        this.logger_.debug(message + ' ...');
        action.acquire('orchestration.create', function (error, result) {
            if (error) {
                self.logger_.error(message + ' failed. Error: ' +
                                   C.lang.reflect.inspect(error));
                callback(error, null);
                return;
            }
            
            self.logger_.debug(message + ' succeed. Result: ' +
                               C.lang.reflect.inspect(result));
            callback(null, result.id);
        });
    };
    
    C.namespace('caligula.handlers').GroupHandler = GroupHandler;
    
    /**
     * This error type is designed to be thrown when two operations are required
     * to be executed at the same time, but their targets overlap with each
     * other.
     * 
     * @class OperationConflictError
     * @constructor
     * @extends ConflictError
     * @param {String} message the error message associated with this error
     */
    function OperationConflictError (message) {
        /* inheritance */
        this.super();
    }
    
    C.lang.inherit(OperationConflictError, C.caligula.errors.ConflictError);
    
    C.namespace('caligula.errors').OperationConflictError = OperationConflictError;

}, '0.0.1', { requires: ['caligula.handlers.base', 'caligula.utils.logging'] });