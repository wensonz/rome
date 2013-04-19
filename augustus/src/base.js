/**
 * This module contains the implementation of class ConfigurationHandler, which
 * is designed to be not only the base class of all other concrete configuration 
 * related handlers, but also the handler to handle the actions that can not be
 * categorized into any concrete configuration types, such as the generation of
 * the specified configuration, etc.
 *
 * @module caligula.components.configuration.base
 */
Condotti.add('caligula.components.configuration.base', function (C) {
    
    /**
     * This ConfigurationHandler is designed to be not only the base class of 
     * all other concrete configuration related handlers, such as the role 
     * handler, but also the handler to handle the actions that can not be
     * categorized into any concrete configuration types, such as the generation 
     * of the specified configuration, etc.
     *
     * @class ConfigurationHandler
     * @constructor
     */
    function ConfigurationHandler () {
        /* inheritance */
        this.super();
    }
    
    C.lang.inherit(ConfigurationHandler, C.caligula.handlers.Handler);
    
    /**
     * Return the next revision number can be used in operating configuration
     * data.
     *
     * @method getNextRevision_
     * @param {Action} action the action which causes a configuration change,
     *                        thus requires a new revision number
     * @param {Function} callback the callback function to be invoked after the
     *                            revision has been successfully retrieved, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error, revision) {}'
     */
    ConfigurationHandler.prototype.getNextRevision_ = function(action, callback) {
        var params = action.data,
            self = this,
            message = null;

        message = 'Acquiring counter.increase on \'revision\'';
        this.logger_.debug(message + ' ...');

        action.data = { name: 'revision', value: 1 };
        action.acquire('counter.increase', function (error, result) {
            action.data = params;

            if (error) {
                self.logger_.debug(message + ' failed. Error: ' + 
                                   C.lang.reflect.inspect(error));
                callback(error, null);
                return;
            }

            self.logger_.debug(message + ' succeed. Revision: ' + result.value);
            callback(null, result.value);
        });
    };
    
    /**
     * Lock the entire configuration updates/creation
     *
     * @method lock_
     * @param {Action} action the action which causes a configuration change,
     *                        thus requires locking the entire configuration
     *                        first
     * @param {Function} callback the callback function to be invoked after the
     *                            lock has been acquired successfully, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error, id) {}'
     */
    ConfigurationHandler.prototype.lock_ = function(action, callback) {
        var params = action.data,
            self = this,
            message = null;

        message = 'Calling lock.acquire on \'configuration\'';
        this.logger_.debug(message + ' ...');

        action.data = { name: 'configuration', lease: 5000 }; // max lifespan for a lock
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
     * Unlock the entire configuration updates/creation
     *
     * @method unlock_
     * @param {Action} action the action which causes a configuration change,
     *                        thus requires locking the entire configuration
     *                        first
     * @param {String} id the owner id of the lock currently hold
     * @param {Function} callback the callback function to be invoked after the
     *                            lock has been acquired successfully, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error, id) {}'
     */
    ConfigurationHandler.prototype.lock_ = function(action, id, callback) {
        var params = action.data,
            self = this,
            message = null;

        message = 'Calling lock.release on \'configuration\'';
        this.logger_.debug(message + ' ...');

        action.data = { name: 'configuration', owner: id };
        action.acquire('lock.release', function (error, result) {
            action.data = params;

            if (error) {
                self.logger_.debug(message + ' failed. Error: ' + 
                                   C.lang.reflect.inspect(error));
                callback(error, null);
                return;
            }

            self.logger_.debug(message + ' succeed. ');
            callback(null, result);
        });
    };
    
    
    /**
     * Create one or more configuration records.
     *
     * @method create
     * @param {Action} action the creation action to be handled
     */
    ConfigurationHandler.prototype.create = function (action) {
        var self = this,
            params = action.data,
            message = null,
            revision = null,
            names = null,
            lock = null;

        // TODO: param check
        if (!Array.isArray(params)) {
            params = [params];
        }

        C.async.waterfall([
            function (next) { // acquiring lock
                 message = 'Acquiring the configuration lock for creating';
                self.logger_.debug(message + ' ...');
                self.lock_(action, next);
            },
            function (result, next) { // double confirm that there is no any object in
                              // the database with the same name as the one
                              // to be created
                self.logger_.debug(message + ' succeed.');
                lock = result;
                
                names = params.map(function (param) { return param.name; });
                message = 'Double confirming the non-existence of the names ' +
                          'to be created: ' + names.toString() + ' via query';
                self.logger_.debug(message + ' ...');
                action.data = {
                    criteria: { name: { '$in': names } },
                    fields: { name: 1 }
                };
                action.acquire(
                    'data.configuration.read',
                    next
                );
            },
            function (result, next) { // get revision to be used
                self.logger_.debug(message + ' succeed. The existings: ' + 
                                   C.lang.reflect.inspect(result));
                if (result.length > 0) {
                    names = result.map(function (item) {
                        return item.name;
                    });
                    
                    next(new C.caligula.errors.InvalidArgumentError(
                        'There have already been some configurations ' + 
                        'whose name is in: ' + names.toString()
                    ));
                    return;
                }
                
                message = 'Generating the revision number to be used';
                self.logger_.debug(message + ' ...');
                self.getNextRevision_(action, next);
            },
            function (result, next) {
                self.logger_.debug(message + ' succeed. Revision: ' + result);
                revision = result;
                
                params.forEach(function (param) { param.revision = revision; });
                action.data = params;
                
                message = 'Creating configuration(s)' +
                          C.lang.reflect.inspect(params);
                self.logger_.debug(message + ' ...');
                
                action.acquire(
                    'data.configuration.create',
                    next
                );
            }
        ], function (error, result) {
            
            var cleanup = function () {
                if (error) {
                    self.logger_.error(message + ' failed. Error: ' +
                                       C.lang.reflect.inspect(error));
                    action.error(error);
                    return;
                }
                
                self.logger_.debug(message + ' succeed.');
                action.done({
                    revision: revision
                });
            };
            
            if (lock) {
                self.logger_.debug('Releasing the configuration lock for ' +
                                   'creating ...');
                self.unlock_(action, lock, cleanup);
                return;
            }
            
            cleanup();
        });
    };
    
    /**
     * Update a configuration record and put the original one into the history
     * collection. Revision is to be checked before the updating, since another
     * update may happen before this one with the same original record.
     *
     * @method update
     * @param {Action} action the update action to be handled
     */
    ConfigurationHandler.prototype.update = function (action) {
        var self = this,
            params = action.data,
            message = null,
            revision = null,
            lock = null,
            revisions = {};

        // TODO: param check
        if (!Array.isArray(params)) {
            params = [params];
        }
        
        
        C.async.waterfall([
            function (next) { // acquire the updating lock
                message = 'Acquiring the configuration lock for updating';
                self.logger_.debug(message + ' ...');
                self.lock_(action, next);
            },
            function (result, next) { // read the current configuration
                var names = null;
                
                self.logger_.debug(message + ' succeed.');
                lock = result;
                // prepare the following data:
                // 1. the revision dictionary for comparing with the current 
                //    ones in database
                // 2. the names to be updated for querying the database
                names = params.map(function (param) {
                    revisions[param.name] = param.revision;
                    return param.name; 
                });

                message = 'Reading the current configurations with name in ' + 
                          C.lang.reflect.inspect(names);
                self.logger_.debug(message + ' ...');
                
                action.data = { 
                    criteria: { name: { '$in': names }}, 
                    fields: { name: 1, revision: 1 }
                };
                
                action.acquire(
                    'data.configuration.read',
                    next
                );
            },
            function (result, next) { // verify the configurations to be updated
                                      // exist in the database
                
                self.logger_.debug(message + ' succeed. Configuration: ' +
                                   C.lang.reflect.inspect(result.data));
                
                message = 'Verifying the configuration(s) exist in the database';
                self.logger_.debug(message + ' ...');
                
                if (result.data.length !== params.length) {
                    next(new C.caligula.errors.InvalidArgumentError(
                        'Some of the configuration(s) to be updated can not ' +
                        'be found in database. Required: ' + params.length + 
                        ', found: ' + result.data.length
                    ));
                    return;
                }
                
                next(null, result.data);
            },
            function (current, next) { // verify the corresponding 
                                       // configurations of the ones to be
                                       // updated in the database keep unchanged 
                                       // after they are checked out by 
                                       // comparing the revisions
                var changed = null;
                
                self.logger_.debug(message + ' succeed.');
                
                message = 'Verifying the revisions of the configurations to ' +
                          'be updated match with those of the current ones';
                self.logger_.debug(message + ' ...');
                
                changed = current.filter(function (item) {
                    return item.revision !== revisions[item.name];
                }).map(function (item) { // name: expected < current revision
                    return item.name + ': ' + revisions[item.name] + ' < ' +
                           item.revision;
                });
                
                if (changed.length > 0) {
                    next(new C.caligula.errors.InvalidArgumentError(
                        'The corresponsive configuration(s) in the database ' +
                        'of the following have been changed after they were ' +
                        'checked out: ' + changed.join(', ')
                    ));
                    return;
                }
                
                next();
            },
            function (next) { // Getting the next revision
                
                self.logger_.debug(message + ' succeed.');
                
                message = 'Generating the revision number to be used';
                self.logger_.debug(message + ' ...');
                self.getNextRevision_(action, next);
            },
            function (result, next) {
                self.logger_.debug(message + ' succeed. Revision: ' + result);
                revision = result;

                message = 'Updating configuration(s) ' +
                          C.lang.reflect.inspect(params);
                self.logger_.debug(message + ' ...');
                
                action.data = params;
                action.acquire(
                    'data.configuration.create',
                    next
                );
            }
        ], function (error) {
            
            var cleanup = function () {
                if (error) {
                    self.logger_.error(message + ' failed. Error: ' +
                                       C.lang.reflect.inspect(error));
                    action.error(error);
                    return;
                }
                
                self.logger_.debug(message + ' succeed.');
                action.done({
                    revision: revision
                });
            };
            
            if (lock) {
                self.logger_.debug('Releasing the configuration lock for ' +
                                   'updating ...');
                self.unlock_(action, lock, cleanup);
                return;
            }
            
            cleanup();
        });
    };

    /**
     * Return the required configuration object conform to the provided criteria
     *
     * @method read
     * @param {Action} action the reading action to be handled
     */
    ConfigurationHandler.prototype.read = function(action) {
        var params = action.data,
            self = this;
        
        action.data = {
            //
        };
        action.data.by = 'name';
        action.data.aggregation = { revision: { '$max': 'revision' }};
        
        action.acquire(
            'data.configuration.group', 
            function (error, result) {
                if (error) {
                    action.error(error);
                    return;
                }
                action.done(result);
            }
        );
    };

    /**
     * Delete the configurations satisfy the provided criteria. This method will
     * copy the records to be deleted to the history before deleting for sake.
     *
     * @method delete
     * @param {Action} action the deleting action to be handled
     */
    ConfigurationHandler.prototype.delete = function(action) {
        var self = this,
            params = action.data,
            message = null,
            data = null,
            lock = null,
            revision = -1;

        
        C.async.waterfall([
            function (next) { // querying the configurations to be deleted
                message = 'Reading the ' + self.getConfigurationType_() +
                          '(s) to be deleted according to the specified ' +
                          'criteria';
                self.logger_.debug(message + ' ...');
                action.acquire(
                    'data.' + self.getConfigurationType_() + '.read',
                    next
                );
            },
            function (result, next) { // saving to the history
                self.logger_.debug(message + ' succeed. ' + result.affected + 
                                   ' to be deleted: ' +
                                   C.lang.reflect.inspect(result.data));
                
                params = result.data;
                message = 'Saving ' + self.getConfigurationType_() + 
                          '(s) to be deleted into history';
                self.logger_.debug(message + ' ...');
                action.data = params;
                action.acquire(
                    'data.' + self.getConfigurationType_() + '-history.create',
                    next
                );
            },
            function (result, next) { // deleting the specified configurations
                self.logger_.debug(message + ' succeed.');
                message = 'Deleting ' + params.length + ' ' + 
                          self.getConfigurationType_() + '(s) in parallel';
                self.logger_.debug(message + ' ...');
                C.async.forEach(params, deleteOne, next);
            }
        ], function (error, result) {
            if (error) {
                self.logger_.debug(message + ' failed. Error: ' +
                                   C.lang.reflect.inspect(error));
                action.error(error)
                return;
            }

            self.logger_.debug(message + ' complete. Failures: ' +
                               C.lang.reflect.inspect(failures));
            if (Object.keys(failures).length > 0) {
                action.error(new C.caligula.errors.PartialFailedError(failures));
                return;
            }

            action.done({
                revision: revision
            });
        });
    };

    /**
     * Return the required history records according to the specified criteria
     * and the operations.
     *
     * @method history
     * @param {Action} action the history reading action to be handled
     */
    ConfigurationHandler.prototype.history = function(action) {
        var self = this,
            message = null;

        message = 'Reading ' + this.getConfigurationType_() + ' history';
        this.logger_.debug(message + ' ...');

        action.acquire(
            'data.' + this.getConfigurationType_() + '-history.read',
            function (error, result) {
                if (error) {
                    self.logger_.error(message + ' failed. Error: ' + 
                                       C.lang.reflect.inspect(error));
                    action.error(error);
                    return;
                }
                self.logger_.debug(message + ' succeed. Result: ' +
                                   C.lang.reflect.inspect(result));
                action.done(result);
            }
        );
    };
    
    C.namespace('caligula.handlers.configuration').ConfigurationHandler = 
        ConfigurationHandler;
    
}, '0.0.1', { requires: ['caligula.handlers.base'] });
