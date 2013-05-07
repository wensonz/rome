/**
 * This module contains the implementation of the DataHandler class, which is
 * designed to handle all data storage related actions, such as CRUD, etc.
 *
 * @module caligula.components.data.base
 */
Condotti.add('caligula.components.data.base', function (C) {
    
    var Handler = C.caligula.handlers.Handler,
        V = C.validators;
    
    /**
     * This DataHandler class is designed to handle the actions related with
     * the data storage, such as the CRUD, etc.
     *
     * @class DataHandler
     * @constructor
     * @extends Handler
     * @param {Object} config the config object for this data handler
     * @param {MongoConnectionFactory} factory the connection factory used to 
     *                                         get connection to the database
     *                                         server
     */
    function DataHandler (config, factory) {
        /* inheritance */
        this.super();
        
        /**
         * The config object for this data handler
         *
         * @property config_
         * @type Object
         * @default {}
         */
        this.config_ = config || {};
        
        /**
         * The connection factory used to get connection to the database
         * server
         * 
         * @property factory_
         * @type MongoConnectionFactory
         * @deafult factory
         */
        this.factory_ = factory;
        
        /**
         * The collection name this handler is to operate on
         * 
         * @property collection_
         * @type String
         * @deafult null
         */
        this.collection_ = this.config_.collection;
    }
    
    C.lang.inherit(DataHandler, Handler);
    
    /**
     * Return the collection name to be operated on based on the configuration
     * and the required action
     *
     * @method getCollectionName_
     * @param {Action} action the action to be handled
     * @return {String} the collection name to be operated on
     */
    DataHandler.prototype.getCollectionName_ = function (action) {
        var tokens = null;
        
        if (this.collection_) {
            return this.collection_;
        }
        
        tokens = action.name.split('.');
        if (tokens.length < 2) {
            return tokens[0];
        }
        
        return tokens[tokens.length - 2]; // the url is supposed to be
                                          // abc/def/op, thus the "def"
                                          // is assumed to be the name
                                          // of the collection
    };
    
    
    /**
     * Execute the specified command with the description name
     *
     * @method execute_
     * @param {Action} action the action to be handled
     * @param {Object} data the data params to be handled, which is supposed to
     *                      one property of the action, however, in some
     *                      scenario, such as the 'read', two queries are
     *                      executed in parallel with one action object, this
     *                      data param is provided separately.
     * @param {String} method the name of the method of the collection to be 
     *                        executed
     * @param {String} description the description of the action, such as 
     *                             'Reading', 'Updating', etc.
     * @param {Function} callback the callback function to be invoked after the
     *                            execution has been successfully completed, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error, result) {}'
     */
    DataHandler.prototype.execute_ = function (action, data, method, description,
                                               callback) {
        var self = this,
            message = null,
            connection = null,
            name = null;
        
        name = this.getCollectionName_(action);
        C.async.waterfall([
            function (next) {
                message = 'Getting the connection for collection ' + name;
                self.logger_.debug(message + ' ...');
                self.factory_.get(name, next);
            },
            function (result, next) {
                self.logger_.debug(message + ' succeed.');
                
                message = description + ' data ' + 
                          C.lang.reflect.inspect(data);
                self.logger_.debug(message + ' ...');

                connection = result;
                connection[method].call(connection, data, next);
            }
        ], function (error, result) {
            // close the connection anyway
            connection && connection.close();

            // logging first
            if (error) {
                self.logger_.error(message + ' failed. Error: ' + 
                                   C.lang.reflect.inspect(error));
            } else {
                self.logger_.debug(message + ' succeed.');
            }
            
            if (callback) { // caller want to handle the result and error 
                callback(error, result);
            } else if (error) { // default action 
                action.error(new C.caligula.errors.InternalServerError());
            } else {
                action.done({ affected: result });
            }
        });
    };
    
    
    /**
     * Create one or more data objects into the database
     *
     * @method create
     * @param {Action} action the creation action to be handled
     */
    DataHandler.prototype.create = function (action) {
        this.execute_(action, action.data, 'create', 'Creating');
    };
    
    /**
     * Update the specified data records based on the selector and the update
     * data
     *
     * @method update
     * @param {Action} action the update action to be handled
     */
    DataHandler.prototype.update = function (action) {
        this.execute_(action, action.data, 'update', 'Updating');
    };
    
    DataHandler.prototype.update = Handler.validate(
        DataHandler.prototype.update,
        new V.ObjectValidator('action', {
            'data.criteria': new V.OptionalValidator(new V.TypeValidator(
                                                        'criteria', Object
                                                    )),
            'data.update': new V.TypeValidator('update', Object)
        })
    );
    
    /**
     * Delete the data records fulfill the specified criteria in the passed-in
     * data
     *
     * @method delete
     * @param {Action} action the delete action to be handled
     */
    DataHandler.prototype.delete = function (action) {
        this.execute_(action, action.data, 'delete', 'Deleting');
    };

    /**
     * Return the number of the records fulfill the specified criteria and
     * the scope from 'skip' to 'skip' + 'limit'
     *
     * @method count
     * @param {Action} action the couting action to be handled
     */
    DataHandler.prototype.count = function(action) {
        this.execute_(
            action, action.data, 'count', 'Counting', 
            function (error, result) {
                if (error) {
                    action.error(new C.caligula.errors.InternalServerError());
                    return;
                }
                action.done({
                    affected: 1,
                    data: result
                });
            }
        );
    };
    
    /**
     * Group the records with the help of the "group" method of the Connection.
     * The data structure of the passed-in param is like:
     * {
     *     criteria: ${criteria},
     *     fields: ${fields},
     *     operations: {
     *         skip: ${skip},
     *         limit: ${limit},
     *         sort: ${sort}
     *     },
     *     by: ${field to group by},
     *     aggregation:${aggregation fields using $max, $min, $sum or $avg}
     * }
     * 
     * @method group
     * @param {Action} action the grouping action to be handled
     */
    DataHandler.prototype.group = function (action) {
        this.execute_(
            action, action.data, 'group', 'Grouping', function(error, result) {
                if (error) {
                    action.error(new C.caligula.errors.InternalServerError());
                    return;
                }
                action.done({
                    affected: result.length,
                    data: result
                });
            }
        );
    };
    
    /**
     * Read the data records according to the specified criteria. Note that the
     * "affected" field of the result of this method now means only the actual
     * number of records that satisfy both criteria and operations, but not the
     * number of the records which only satisfy the criteria but omit the "skip"
     * and "limit" settings.
     *
     * @method read
     * @param {Action} action the read action to be handled
     */
    DataHandler.prototype.read = function (action) {
        var params = action.data;

        // handling count
        if (params.operations && params.operations.count) {
            this.count(action);
            return;
        }
        
        action.data.fields = action.data.fields || {};
        action.data.fields._id = action.data.fields._id || 0;
        
        // real query
        this.execute_(
            action, action.data, 'read', 'Reading', function(error, result) {
                if (error) {
                    action.error(new C.caligula.errors.InternalServerError());
                    return;
                }
                action.done({
                    affected: result.length,
                    data: result
                });
            }
        );
    };
    
    /**
     * Compare and Set
     *
     * @method cas
     * @param {Action} action the cas action to be handled
     */
    DataHandler.prototype.cas = function (action) {
        
        this.execute_(
            action, action.data, 'cas', 'Comparing and Setting', 
            function (error, result) {
                if (error) {
                    action.error(new C.caligula.errors.InternalServerError());
                    return;
                }
                
                // Remove the fxxking '_id' from record
                result && delete result._id;
                
                action.done({
                    affected: result ? 1 : 0,
                    data: result
                });
            }
        );
    };
    
    /**
     * Magic "default" method used to handle the required action like 'data.xxx'
     * where this handler is plugged on the 'data'.
     * 
     * @method default
     * @param {Action} action the action to be handled
     */
    DataHandler.prototype.default = function (action) {
        var tokens = null,
            method = null;
            
        tokens = action.name.split('.');
        method = tokens[tokens.length - 1]; // the last segment is supposed to
                                            // be the method to be called
        this[method].call(this, action);
    };
    
    
    C.namespace('caligula.handlers').DataHandler = DataHandler;
    
}, '0.0.1', { requires: ['caligula.handlers.base', 
                         'caligula.components.data.mongo'] });
