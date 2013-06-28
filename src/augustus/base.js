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
    // TODO: double check if the _id is returned
    
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
        // TODO: double check the result data format
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

            self.logger_.debug(message + ' succeed. Revision: ' + 
                               result.value);
                               
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
    ConfigurationHandler.prototype.unlock_ = function(action, id, callback) {
        var params = action.data,
            self = this,
            message = null;
            
        callback = callback || function () {};
        message = 'Calling lock.release on \'configuration\'';
        this.logger_.debug(message + ' ...');

        action.data = { name: 'configuration', owner: id };
        action.acquire('lock.release', function (error) {
            action.data = params;

            if (error) {
                self.logger_.debug(message + ' failed. Error: ' + 
                                   C.lang.reflect.inspect(error));
                callback(error, null);
                return;
            }

            self.logger_.debug(message + ' succeed. ');
            callback();
        });
    };
    
    /**
     * Return the ids of the most recent configurations
     * 
     * @method getCurrentConfigurationIds_
     * @param {Action} action the action to be completed
     * @param {Object} names the set of configuration names to filter out the 
     *                       returned ids whose name is not in this list
     * @param {Function} callback the callback function to be invoked after the
     *                            ids have been successfully retrieved, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error, ids) {}'
     */
    ConfigurationHandler.prototype.getCurrentConfigurationIds_ = function (action, names, callback) {
        var params = action.data,
            self = this,
            message = null;
        
        if (C.lang.reflect.isFunction(names)) {
            callback = names;
            names = null;
        }
        
        action.data = {
            fields: { cid: 1, name: 1, revision: 1, deleted: '__deleted__' },
            operations: { sort: { revision: 1 } },
            by: 'name',
            aggregation: { 
                cid: { '$first': 'cid' }, 
                revision: { '$first': 'revision'},
                deleted: { '$first': 'deleted' }
            }
        };
        
        message = 'Calling data.configuration.group with params ' + 
                  C.lang.reflect.inspect(action.data) + ' to get the ids of ' +
                  'the most recent configurations';
        
        this.logger_.debug(message + ' ...');
        action.acquire('data.configuration.group', function (error, result) {
            var ids = null;
            
            action.data = params;
            
            if (error) {
                self.logger_.debug(message + ' failed. Error: ' +
                                   C.lang.reflect.inspect(error));
                callback(error, null);
                return;
            }
            
            self.logger_.debug(message + ' succeed. Result: ' + 
                               C.lang.reflect.inspect(result));
            
            ids = result.data.filter(function(item) {
                return !item.deleted && (!names || names[item._id]);
            }).map(function (item) {
                return names ? { // name list specified
                    cid: item.cid, name: item._id, revision: item.revision
                } : item.cid; // otherwise only oid is returned
            });
            
            callback(null, ids);
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
            function (result, next) { // read the current configuration to make
                                      // sure that non of the names are taken
                                      // already
                
                self.logger_.debug(message + ' succeed.');
                lock = result;
                
                names = params.map(function (param) { return param.name; });
                message = 'Reading the current configurations with name in ' + 
                          C.lang.reflect.inspect(names);
                self.logger_.debug(message + ' ...');
                
                self.getCurrentConfigurationIds_(action, names, next);
            },
            function (result, next) { // Double confirm and get revision
                
                self.logger_.debug(message + ' succeed.');
                
                message = 'Double confirming that none of the names to be ' +
                          'created has been already taken: ' + names.toString();
                self.logger_.debug(message + ' ...');
                
                if (result.length) {
                    next(new C.caligula.errors.InvalidArgumentError(
                        'Following names have been taken: ' + 
                        result.forEach(function (item) { return item.name; })
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
                // Update revision and assign a global unique "cid", which is
                // used to replace the "_id" for query simplicity
                params.forEach(function (param) { 
                    param.revision = revision;
                    param.cid = C.uuid.v4();
                });
                action.data = params;
                
                message = 'Creating configuration(s)' +
                          C.lang.reflect.inspect(params);
                self.logger_.debug(message + ' ...');
                
                action.acquire('data.configuration.create', next);
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
                action.done({ revision: revision });
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
            revisions = {},
            names = {}; // configuration names to be updated

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
                
                self.logger_.debug(message + ' succeed.');
                lock = result;
                // prepare the following data:
                // 1. the revision dictionary for comparing with the current 
                //    ones in database
                // 2. the names to be updated for querying the database
                params.forEach(function (param) {
                    revisions[param.name] = param.revision;
                    names[param.name] = true;
                });
                
                message = 'Reading the current configurations with name in ' + 
                          C.lang.reflect.inspect(names);
                self.logger_.debug(message + ' ...');
                
                self.getCurrentConfigurationIds_(action, names, next);
            },
            function (result, next) { // verify the configurations to be updated
                                      // exist in the database
                var missed = null,
                    existing = {};
                self.logger_.debug(message + ' succeed. Result: ' +
                                   C.lang.reflect.inspect(result));
                
                message = 'Verifying the configuration(s) exist now';
                self.logger_.debug(message + ' ...');
                
                result.forEach(function (item) {
                    return existing[item.name] = true;
                });
                
                missed = params.filter(function (param) {
                    return !param.name in existing;
                }).map(function (param) {
                    return param.name;
                });
                
                if (missed.length) {
                    next(new C.caligula.errors.InvalidArgumentError(
                        'Configurations with the following names do not exist' +
                        ' now: ' + missed.toString()));
                    return;
                }
                
                next(null, result);
            },
            function (existings, next) { // verify the corresponding 
                                       // configurations of the ones to be
                                       // updated in the database keep unchanged 
                                       // after they are checked out by 
                                       // comparing the revisions
                var changed = null;
                
                self.logger_.debug(message + ' succeed.');
                
                message = 'Verifying the revisions of the configurations to ' +
                          'be updated match with those of the existing ones';
                self.logger_.debug(message + ' ...');
                
                changed = existings.filter(function (item) {
                    return item.revision !== revisions[item.name];
                }).map(function (item) { // name: expected < current revision
                    return item.name + ': ' + revisions[item.name] + ' < ' +
                           item.revision;
                });
                
                if (changed.length) {
                    next(new C.caligula.errors.InvalidArgumentError(
                        'The corresponsive configuration(s) in the data store' +
                        ' of the following have been changed after they were ' +
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
                // Create new configuration objects with new cid
                params.forEach(function(param) {
                    param.revision = revision;
                    param.cid = C.uuid.v4();
                });
                
                message = 'Updating configuration(s) ' +
                          C.lang.reflect.inspect(params);
                self.logger_.debug(message + ' ...');
                
                action.data = params;
                action.acquire('data.configuration.create', next);
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
            self = this,
            message = null;
        
        C.async.waterfall([
            function (next) { // query the most recent version of configurations
                
                message = 'Getting the ids of the configuration objects';
                self.logger_.debug(message + ' ...');
                self.getCurrentConfigurationIds_(action, next);
            },
            function (ids, next) { // execute the query
                self.logger_.debug(message + ' succeed. IDs: ' +
                                   C.lang.reflect.inspect(ids));
                
                message = 'Executing user specified query ' +
                          C.lang.reflect.inspect(params) + 
                          ' on top of the objects ' + ids.toString();
                          
                self.logger_.debug(message + ' ...');
                
                if (params.criteria) {
                    params.criteria =  { '$and': [ 
                        { cid: { '$in': ids }},
                        params.criteria
                    ]};
                } else {
                    params.criteria = { cid: { '$in': ids }};
                }
                action.data = params;
                
                action.acquire('data.configuration.read', next);
            }
        ], function(error, result) {
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
            lock = null;

        
        C.async.waterfall([
            function (next) { // acquire the deleting lock
                message = 'Acquiring the configuration lock for deleting';
                self.logger_.debug(message + ' ...');
                self.lock_(action, next);
            },
            function (result, next) { // query the most recent version of configurations
                
                self.logger_.debug(message + ' succeed. Owner id: ' + result);
                lock = result;
                
                message = 'Getting the ids of the current configuration objects';
                
                self.logger_.debug(message + ' ...');
                self.getCurrentConfigurationIds_(action, next);
            },
            function (ids, next) { // update the configuration to be deleted
                
                self.logger_.debug(message + ' succeed. IDs: ' +
                                   C.lang.reflect.inspect(ids));
                
                message = 'Removing configurations with user specified params ' +
                          C.lang.reflect.inspect(params) + 
                          ' on top of the objects ' + ids.toString();
                          
                self.logger_.debug(message + ' ...');
                
                if (params.criteria) {
                    params.criteria =  { '$and': [ 
                        { cid: { '$in': ids }},
                        params.criteria
                    ]};
                } else {
                    params.criteria = { cid: { '$in': ids }};
                }
                
                params.update = { '$set': { '__deleted__': true }};
                action.data = params;
                action.acquire('data.configuration.update', next);
            }
        ], function(error, result) {
            
            var cleanup = function () {
                if (error) {
                    self.logger_.error(message + ' failed. Error: ' +
                                       C.lang.reflect.inspect(error));
                    action.error(error);
                    return;
                }
                
                self.logger_.debug(message + ' succeed.');
                action.done(result);
            };
            
            if (lock) {
                self.logger_.debug('Releasing the configuration lock for ' +
                                   'deleting ...');
                self.unlock_(action, lock, cleanup);
                return;
            }
            
            cleanup();
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
            params = action.data,
            lock = null,
            ids = null,
            message = null;
        
        C.async.waterfall([
            function (next) { // acquiring lock
                message = 'Acquiring the configuration lock for history';
                self.logger_.debug(message + ' ...');
                self.lock_(action, next);
            },
            function (result, next) { // read the current configuration to find
                                      // out the configurations to be moved
                
                self.logger_.debug(message + ' succeed.');
                lock = result;
                
                message = 'Reading the current configurations';
                self.logger_.debug(message + ' ...');
                
                self.getCurrentConfigurationIds_(action, next);
            },
            function (result, next) { // Double confirm and get revision
                
                self.logger_.debug(message + ' succeed.');
                ids = result;
                
                message = 'Reading the old or deleted configurations';
                self.logger_.debug(message + ' ...');
                
                action.data = { criteria: { cid: { '$nin': ids }}};
                action.acquire('data.configuration.read', next);
            },
            function (result, meta, next) { // add those old or deleted configuration into history
                self.logger_.debug(message + ' succeed. Result: ' +
                                   C.lang.reflect.inspect(result));
                
                action.data = result.data;
                action.acquire('data.configuration-history.create', next);
            },
            function (result, meta, next) { // remove the historic configurations
                self.logger_.debug(message + ' succeed. Result: ' +
                                   C.lang.reflect.inspect(result));
                
                message = 'Removing the historic configurations whose id is' +
                          ' not in ' + ids.toString();
                self.logger_.debug(message + ' ...');
                action.data = { criteria: { cid: { '$nin': ids}}};
                action.acquire('data.configuration.delete', next);
            },
            function (result, meta, next) { // query history
                self.logger_.debug(message + ' succeed. Result: ' +
                                   C.lang.reflect.inspect(result));
                
                message = 'Querying the history of the configurations with ' +
                          'the user speicifed params: ' +
                          C.lang.reflect.inspect(params);
                self.logger_.debug(message + ' ...');
                action.data = params;
                action.acquire('data.configuration-history.read', next);
            }
        ], function(error, result) {
            var cleanup = function () {
                if (error) {
                    self.logger_.error(message + ' failed. Error: ' +
                                       C.lang.reflect.inspect(error));
                    action.error(error);
                    return;
                }
                
                self.logger_.debug(message + ' succeed.');
                action.done(result);
            };
            
            if (lock) {
                self.logger_.debug('Releasing the configuration lock for ' +
                                   'history ...');
                self.unlock_(action, lock, cleanup);
                return;
            }
            
            cleanup();
        });
    };
    
    C.namespace('caligula.handlers.configuration').ConfigurationHandler = 
        ConfigurationHandler;
    
}, '0.0.1', { requires: ['caligula.handlers.base'] });
