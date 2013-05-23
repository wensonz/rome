/**
 * This module contains the implementation of the 'status' API for the group
 * based publishing API
 *
 * @module caligula.components.publishing.group.status
 */
Condotti.add('caligula.components.publishing.group.status', function (C) {
    
    /**
     * This StatusHandler is designed to handle the status query action to a
     * specified group
     *
     * @class StatusHandler
     * @constructor
     * @extends C.caligula.handlers.Handler
     */
    function StatusHandler () {
        /* inheritance */
        this.super();
    }
    
    C.lang.inherit(StatusHandler, C.caligula.handlers.Handler);
    
    /**
     * Handle the status query action
     *
     * @method call
     * @param {Action} action the status query action to be handled
     */
    StatusHandler.prototype.call = function (action) {
        // TODO: 
        //      1. Read group object
        //      2. Read latest operation log
        //      3. Read orchestration job
        //      4. Construct the status object
        
        var self = this,
            params = action.data,
            log = null,
            group = null,
            deployment = null, // deployment job status
            Progress = C.caligula.publishing.group.constants.Progress,
            progress = Progress.INITIAL,
            internal = !!action.data.internal, // indirectly called by other API
            locked = false, // another client is operating now
            logger = new C.caligula.utils.logging.StepLogger(this.logger_);
        
        // Remove the internal flag first
        delete action.data.internal;
        
        C.async.waterfall([
            function (next) { // Check if the lock is hold
                if (internal) {
                    next();
                    return;
                }
                
                logger.start('Querying the lock of the operations to see if ' +
                             'another client is operating on group ' + 
                             params.name + ' now');
                action.data = { name: 'publishing.group.' + params.name };
                action.acquire('lock.acquired', next);
            },
            function (result, next) { // Read the group object
                if (C.lang.reflect.isFunction(result)) {
                    next = result;
                    result = undefined;
                } else {
                    logger.done(result);
                    locked = result.acquired;
                }
                
                logger.start('Reading the group details for ' + params.name);
                action.data = { criteria: { name: params.name } };
                action.acquire('data.publishing.group.read', next);
            },
            function (result, next) { // Read the most recent operation log
                logger.done(result);
                
                if (result.affected > 0) {
                    group = result.data[0];
                }
                
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
            function (result, next) { // Read deployment job if necessary
                logger.done(result);
                
                if (result.affected > 0) {
                    log = result.data[0];
                    progress = Progress.OPERATION_LOG_CREATED;
                    
                    if ((group && group.operation === log.id) ||
                        (!group && log.operator === 'delete')) {
                        progress = Progress.GROUP_UPDATED;
                    }
                    
                    if (log.revision) {
                        progress = Progress.TAG_CREATED;
                    }
                    
                    if (log.deployment) {
                        progress = Progress.DEPLOYMENT_JOB_CREATED;
                    }
                    
                    if (log.status.after) {
                        progress = Progress.COMPLETED;
                    }
                }
                
                if (progress !== Progress.TAG_CREATED) { // no deployment job,
                                                         // or status already                                                        // been calculated
                    self.logger_.debug('Deployment job need not to be read ' +
                                       'because there is no operation log, ' +
                                       'the operation failed before creating' +
                                       ' a deployment job, the job id can be' +
                                       ' found in the log or the status has ' +
                                       'already been calculated.');
                    next();
                    return;
                }
                
                
                // Querying deployment job
                action.data = { criteria: { 'extras': {
                    'group': params.name,
                    'operation': log.id
                }}};
                
                logger.start('Reading the deployment job for group ' +
                             params.name + ' and operation ' + log.id +
                             ' with params: ' + 
                             C.lang.reflect.inspect(action.data));
                             
                action.acquire('orchestration.read', next);
            },
            function (result, next) { // Read the orchestration job status
                
                if (C.lang.reflect.isFunction(result) && 
                    (progress !== Progress.DEPLOYMENT_JOB_CREATED)) {
                    next = result;
                    // result = undefined;
                    next();
                    return;
                }
                
                if (progress === Progress.TAG_CREATED) { // assign the 
                                                         // orchestration job
                                                         // id to the log
                    logger.done(result);
                    if (0 === result.affected) {
                        self.logger_.warn('Expected orchestration job can not' +
                                          ' be found. Query params: ' +
                                          C.lang.reflect.inspect(action.data));
                        next();
                        return;
                    }
                    progress = Progress.DEPLOYMENT_JOB_CREATED;
                    log.deployment = result.data[0].id;
                }
                
                logger.start('Querying the status of the orchestration ' +
                             log.deployment);
                action.data = { id: log.deployment };
                action.acquire('orchestration.stat', next);
            },
            function (result, next) { // Calculate the status object
                
                if (C.lang.reflect.isFunction(result)) {
                    next = result;
                    result = undefined;
                } else {
                    logger.done(result);
                    deployment = result;
                }
                
                logger.start('Calculating the current status of group ' +
                             params.name);
                
                // Detect the corrupted data, or if the group exist 
                if (!group) {
                    if (!log) { // maybe it mean the group does not exist at all
                        next(new C.caligula.errors.GroupNotFoundError(
                            'Required group ' + params.name + ' does not exist'
                        ));
                        return;
                    }

                    if (log.operator !== 'delete') { // last operation is not
                                                     // "delete", however the
                                                     // group has gone
                        next(new C.caligula.errors.InternalServerError(
                            'Group ' + params.name + ' related data has been ' +
                            'corrupted, please contact the admin of the system'
                        ));
                        return;
                    }
                }
                
                next(
                    null, 
                    self.buildStatusObject_(progress, group, log, deployment)
                );
            },
            function (status, next) {
                var message = null;
                
                next(status);
                
                if (log.status.after || (!status.operation) || 
                    (status.operation.state === State.PROCESSING)) {
                    return;
                }
                
                message = 'Updating the status of group ' + params.name +
                          ' after current operation ' + status.operation.id +
                          ': ' + C.lang.reflect.inspect(status);
                          
                self.logger_.debug(message + ' ...');
                action.data = {
                    criteria: { id: status.operation.id },
                    update: { '$set': {
                            'status.after': status
                    }}
                };
                action.acquire('data.publishing.group.operation.update', 
                               function (error, result) {
                    if (error) {
                        self.logger_.warn(message + ' failed. Error: ' +
                                          C.lang.reflect.inspect(error));
                    } else {
                        self.logger_.debug(message + ' succeed.');
                    }
                });
            }
        ], function(error, result) {
            if (error) {
                logger.error(error);
                action.error(error);
                return;
            }
            
            logger.done(result);
            action.done(result);
        });
    };
    
    /**
     * Build the status object
     *
     * @method buildStatusObject_
     * @param {Number} progress the progress enum
     * @param {Object} group the group object
     * @param {Object} log the operation log object
     * @param {Object} deployment the deployment status object if exist
     * @return {Object} the built status object
     */
    StatusHandler.prototype.buildStatusObject_ = function (progress, group, log,
                                                           deployment) {
        //
        // Calculate the status of group
        var status = {},
            State = C.caligula.publishing.group.State,
            Progress = C.caligula.publishing.group.Progress,
            failed = false;
        
        // TODO: add operator and params into status.operation
        switch (progress) {
        case Progress.INITIAL:
            status.group = C.lang.clone(group);
            status.group.state = State.OK;
            status.operation = null;
            break;
        case Progress.OPERATION_LOG_CREATED:
            status.group = log.status.before;
            status.operation = {};
            if (locked) {
                status.operation.state = State.PROCESSING;
            } else {
                status.operation.state = State.FAIL;
                /*
                status.operation.error = 'Updating the data of group ' + 
                                         params.name + ' failed.';
                */
            }
            status.operation.operator = log.operator;
            status.operation.params = log.params;
            break;
        case Progress.GROUP_UPDATED:
            status.group = log.status.before;
            status.operation = {};
            if (locked) {
                status.operation.state = State.PROCESSING;
            } else {
                status.operation.state = State.FAIL;
                /*
                status.operation.error = 'Creating TAG for the new ' +
                                         'configuration for group ' +
                                         params.name + ' failed.';
                */
            }
            status.operation.operator = log.operator;
            status.operation.params = log.params;
            break;
        case Progress.TAG_CREATED:
            status.group = log.status.before;
            status.operation = {};
            if (locked) {
                status.operation.state = State.PROCESSING;
            } else {
                status.operation.state = State.FAIL;
                /*
                status.operation.error = 'Creating deployment job for' +
                                         ' group ' + params.name + 
                                         ' failed';
                */
            }
            status.operation.operator = log.operator;
            status.operation.params = log.params;
            break;
        case Progress.DEPLOYMENT_JOB_CREATED:
            status.group = C.lang.clone(group);
            
            status.group.state = (deployment.job + 1) % 3;
            if (status.group.state === State.OK) {
                failed = deployment.nodes.some(function (node) {
                    return node.stat > 4;
                });
                if (failed) {
                    status.group.state = State.FAIL;
                }
            }
            
            status.operation = {};
            status.operation.state = state.group.state;
            status.operation.details = deployment.nodes;
            status.operation.operator = log.operator;
            status.operation.params = log.params;
            
            break;
        case Progress.COMPLETED:
            status = log.status.after;
            break;
        default:
            break;
        }
        
        return status;
    };
    
    C.namespace('caligula.handlers.publishing.group').StatusHandler =
        StatusHandler;
    
}, '0.0.1', { requires: ['caligula.components.publishing.group.constants'] });