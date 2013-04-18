/**
 * This module contains the implementation of the DataHandler class, which is
 * designed to handle all data storage related actions, such as CRUD, etc.
 *
 * @module caligula.components.data.base
 */
Condotti.add('caligula.components.data.base', function (C) {
    
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
    
    C.lang.inherit(DataHandler, C.caligula.handlers.Handler);
    
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
    DataHandler.prototype.execute_ = function (action, data, method, description
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
        this.execute_(action, action.data, 'insert', 'Creating');
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
     * Read the data records according to the specified criteria
     *
     * @method read
     * @param {Action} action the read action to be handled
     */
    DataHandler.prototype.read = function (action) {
        var params = action.data,
            self = this;

        // handling count
        if ('count' in params.operations) {
            this.count(action);
            return;
        }

        // real query
        C.async.parallel({
            'affected': function (next) {
                self.execute_(action, { criteria: params.criteria }, 'count', 
                              'Counting', next);
            },
            'data': function (next) {
                self.execute_(action, action.data, 'read', 'Reading', next);
            }
        }, function (error, result) {
            if (error) {
                action.error(new C.caligula.errors.InternalServerError());
                return;
            }
            action.done(result);
        });
    };
    
    /**
     * Compare and Set
     *
     * @method cas
     * @param {Action} action the cas action to be handled
     */
    DataHandler.prototype.cas = function (action) {
        this.execute_(
            action, 'cas', 'Comparing and Setting', 
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
     * Try to lock the records that fulfill the criteria specified in data 
     * object for a specified period. This expiry period is designed to setup
     * a deal between the lock holder and the other participants. Within this
     * period after a lock holder get the lock, other participants won't update
     * this locked record, unless the lock holder unlock it, or the period 
     * expires. This design is to make sure that the records can not be locked
     * forever once a lock holder fails to unlock them. The implementation of
     * lock in Mongodb is a field named '__lock__' in the data record, and the
     * value is an object with two sub fields, id and expire, where id is a
     * UUID as the identifier to be returned to the caller, and the expire is
     * a timestamp which indicates when the lock can be unlocked by others in
     * milliseconds.
     *
     * @method lock
     * @param {Action} action the lock action to be handled
     */
    /*
    DataHandler.prototype.lock = function (action) {
        var self = this,
            name = null,
            message = null,
            id = null,
            connection = null,
            count = null,
            locked = null;
        
        name = this.getCollectionName_(action);
        id = C.uuid.v4();
        
        C.async.waterfall([
            function (next) { // Getting connection
                message = 'Getting the connection for collection ' + name;
                          
                self.factory_.get(name, next);
            }, function (result, next) { // Counting based on criteria
                
                self.logger_.debug(message + ' succeed.');
                
                message = 'Reading the total number of records satisfy the ' +
                          'specified criteria';
                connection = result;
                connection.read({
                    'criteria': action.data.criteria,
                    'operations': { 'count': true }
                }, next);
                
            }, function (result, next) { // Updating
                var data = {},
                    now = null;
                
                self.logger_.debug(' succeed.');
                count = result;
                
                
                now = Date.now();
                data.criteria = {'$and': [
                    { '$or': [
                        '__lock__': { '$exists': false },
                        '__lock__.expire': { '$lt': now }
                    ]},
                    action.data.criteria
                ]};
                
                data.update = {
                    '$set': {
                        '__lock__': {
                            'id': id,
                            'expire': now + action.data.expire 
                                      // in milliseconds
                        }
                    }
                };
                
                message = 'Trying to lock ' + count + 
                          ' records with the param data ' + 
                          C.lang.reflect.inspect(data);
                          
                connection.update(data, next);
                
            }, function (result, next) {
                var data = {};
                
                locked = result;
                self.logger_.debug(' succeed. Locked: ' + locked);
                
                if (locked === count) { // all records are locked successfully
                    next(null, false);
                    return;
                }
                
                self.logger_.debug('However not all ' + count + 
                                   ' records are locked. Rolling back ...');
                data.criteria = { '$and': [
                    action.data.criteria,
                    { '__lock__': { '$exists': true, 'id': id }}
                ]};
                data.update = {
                    '$unset': { '__lock__': '' }
                };
                message = 'Rolling back the locked records with param ' +
                          C.lang.reflect.inspect(data);
                          
                connection.update(data, next);
            }
        ], function (error, result) {
            
            connection && connection.close();
            
            if (error) {
                self.logger_.error(message + ' failed. Error: ' + 
                                   C.lang.reflect.inspect(error));
                
                action.error(new C.caligula.errors.InternalServerError());
                return;
            }
            
            if (count !== locked) { // Rolling back successfully
                self.logger_.debug(message + ' succeed.');
                action.error(new C.caligula.errors.LockingFailedError(
                    'Trying to lock ' + count + ' objects, but only ' + locked +
                    ' are locked.'
                ));
                return;
            }
            
            // Lock successfully
            action.done({
                affected: result,
                data: id
            });
        });
    };
    */
    
    C.namespace('caligula.handlers').DataHandler = DataHandler;
    
}, '0.0.1', { requires: ['caligula.handlers.base', 
                         'caligula.components.data.mongo'] });
