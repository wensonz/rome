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

        message = 'Acquiring counter.increase on \'revision\''
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
     * Create a configuration record. This method is a generic implementation
     * after analyzing the requirements of the creation of different
     * configuration data, which only differenciate with each other on the
     * name of the collection in the database. The name of the collection to be
     * used is expected to be a property of the constructor of the current
     * handler instance.
     *
     * @method create
     * @param {Action} action the creation action to be handled
     */
    ConfigurationHandler.prototype.create = function (action) {
        var self = this,
            params = action.data,
            message = null,
            revision = null;

        // TODO: param check
        if (!Array.isArray(params)) {
            params = [params];
        }

        C.async.waterfall([
            function (next) { // double confirm that there is no any object in
                              // the database with the same name as the one
                              // to be created
                var names = null;
                names = params.map(function (param) { return param.name; });

                message = 'Double confirming the non-existence of the names ' +
                          'to be created: ' + names.toString() + ' via query';
                self.logger_.debug(message + ' ...');

                action.data = {
                    criteria: { name: { '$in': names } },
                    fields: { name: 1 }
                };

                action.acquire(
                    'data.' + self.getConfigurationType_() + '.read',
                    next
                );
            },
            function (result, next) { // get revision to be used
                var names = null;
                self.logger_.debug(message + 
                                   ' succeed. The existence: ' + 
                                   C.lang.reflect.inspect(result));

                if (result.length > 0) {
                    names = result.map(function (item) {
                        return item.name;
                    });

                    next(new C.caligula.errors.InvalidArgumentError(
                        'There have already been some ' + 
                        self.getConfigurationType_() + 
                        's with the following names: ' + names.toString()
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
                
                message = 'Creating ' + self.getConfigurationType_() + '(s) ' +
                          C.lang.reflect.inspect(params);
                self.logger_.debug(message + ' ...');

                action.acquire(
                    'data.' + self.getConfigurationType_() + '.create',
                    next
                );
            }
        ], function (error, result) {
            
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
            updateOne = null,
            revision = null,
            failures = {},
            revisions = {};

        // TODO: param check
        if (!Array.isArray(params)) {
            params = [params];
        }

        // update a single record
        updateOne = function (item, next) {
            var ac = action.clone(),
                message = null,
                criteria = null;

            message = 'Updating ' + self.getConfigurationType_() + ' ' + 
                      C.lang.reflect.inspect(item);
            self.logger_.debug(message + ' ...');
            
            criteria = {
                name: item.name,
                revision: item.revision
            };
            item.revision = revision;
            ac.data = {
                criteria: criteria,
                update: item
            };

            ac.acquire(
                'data.' + self.getConfigurationType_() + '.update',
                function (error, result) {
                    if (error) {
                        self.logger_.debug(message + ' failed. Error: ' + 
                                           C.lang.reflect.inspect(error));
                        failures[item.name] = error.toString();
                        next(); // anyway the process has to go on
                        return;
                    }

                    self.logger_.debug(' succeed.');
                    if (1 !== result.affected) {
                        self.logger_.debug('However ' + result.affected + ' ' +
                                           self.getConfigurationType_() + 
                                           '(s) are affected');

                        failures[item.name] = 'A single ' + 
                                              self.getConfigurationType_() +
                                              ' is expected to be updated, ' +
                                              'but ' + result.affected + 
                                              self.getConfigurationType_() +
                                              ' updated.';
                    }
                    next();
                }
            );
        };

        C.async.waterfall([
            function (next) { // read the current configuration records
                var names = null,
                    criteria = null;
                
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
                
                action.data = { criteria: { name: { '$in': names }}};
                action.acquire(
                    'data.' + self.getConfigurationType_() + '.read',
                    next
                );
            },
            function (result, next) { // verify the configurations to be updated
                                      // exist in the database
                var changed = null,
                    matched = false;

                self.logger_.debug(message + ' succeed. Configuration: ' +
                                   C.lang.reflect.inspect(result.data));
                
                message = 'Verifying the ' + self.getConfigurationType_() +
                          '(s) exist in the database';
                self.logger_.debug(message + ' ...');

                if (result.data.length !== params.length) {
                    next(new C.caligula.errors.InvalidArgumentError(
                        'Some of the ' + self.getConfigurationType_() +
                        '(s) to be updated can not be found in database.' +
                        'Required: ' + params.length + ', found: ' + 
                        result.data.length
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
                        'The corresponsive ' + self.getConfigurationType_() + 
                        '(s) of the following in the database have been ' +
                        'changed after they were checked out: ' + 
                        changed.join(', ')
                    ));
                    return;
                }

                next(null, current);
            },
            function (current, next) { // Saving history
                self.logger_.debug(message + ' succeed.');
                message = 'Saving the current ' + self.getConfigurationType_() +
                          ' to be updated into history';
                self.logger_.debug(message + ' ...');
                action.data = current;
                action.acquire(
                    'data.' + self.getConfigurationType_() + '-history.create',
                    next
                );
            },
            function (next) { // Getting the next revision

                self.logger_.debug(message + ' succeed.');

                message = 'Generating the revision number to be used';
                self.logger_.debug(message + ' ...');
                self.getNextRevision_(action, next);
            },
            function (revision, next) {
                self.logger_.debug(message + ' succeed. Revision: ' + revision);

                message = 'Updating ' + self.getConfigurationType_() + '(s) ' +
                          C.lang.reflect.inspect(params) + ' in parallel';
                self.logger_.debug(message + ' ...');

                C.async.forEach(params, updateOne, next);
            }
        ], function (error) {
            
            if (error) {
                self.logger_.error(message + ' failed. Error: ' +
                                   C.lang.reflect.inspect(error));
                action.error(error);
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
     * Return the required configuration object conform to the provided criteria
     *
     * @method read
     * @param {Action} action the reading action to be handled
     */
    ConfigurationHandler.prototype.read = function(action) {
        action.acquire(
            'data.' + this.getConfigurationType_() + '.read', 
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
            deleteOne = null,
            failures = {},
            revision = -1;

        deleteOne = function (item, next) {
            var ac = action.clone(),
                message = null;

            message = 'Deleting ' + self.getConfigurationType_() + ' ' + 
                      C.lang.reflect.inspect(item);
            self.logger_.debug(message + ' ...');

            // find the max revision among the configurations to be deleted, 
            // which is used as the return value
            if (item.revision > revision) {
                revision = item.revision;
            }

            ac.data = {
                criteria: {
                    name: item.name,
                    revision: item.revision
                }
            }
            
            ac.acquire(
                'data.' + self.getConfigurationType_() + '.delete',
                function (error, result) {
                    if (error) {
                        self.logger_.debug(message + ' failed. Error: ' + 
                                           C.lang.reflect.inspect(error));
                        failures[item.name] = error.toString();
                        next(); // go on the process anyway
                        return;
                    }

                    self.logger_.debug(' succeed.');

                    if (1 !== result.affected) {
                        self.logger_.debug('However ' + result.affected + ' ' +
                                           self.getConfigurationType_() + 
                                           '(s) are affected');

                        failures[item.name] = 'A single ' + 
                                              self.getConfigurationType_() +
                                              ' is expected to be deleted, ' +
                                              'but ' + result.affected + 
                                              self.getConfigurationType_() +
                                              ' deleted.';
                    }
                    next();
                }
            );
        };
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
