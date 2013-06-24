/**
 * This module contains the implementation of the TagHandler class, which is
 * designed to handle the tagging action.
 * 
 * @module caligula.components.configuration.tag
 */
Condotti.add('caligula.components.configuration.tag', function (C) {

    /**
     * This TagHandler class is a child of the abstract base Handler, and is
     * designed to handle the tagging action, such as creating, reading, etc.
     * 
     * @class TagHandler
     * @constructor
     * @extends Handler
     */
    function TagHandler () {
        /* inheritance */
        this.super();
    }
    
    C.lang.inherit(TagHandler, C.caligula.handlers.Handler);
    
    /**
     * Create a new tag with the provided revision. If the revision is not
     * specified, current revision number is used.
     * 
     * @method create
     * @param {Action} action the tagging creation action to be handled
     */
    TagHandler.prototype.create = function (action) {
        var params = action.data,
            self = this,
            message = null;
        
        C.async.waterfall([
            function (next) {
                message = 'Getting revision number for tag creation';
                self.logger_.debug(message + ' ...');
                
                if (params.revision) {
                    next(null, params.revision, {});
                    return;
                }
                
                action.data = { 'name': 'revision', 'value': 0 };
                action.acquire('counter.increase', next);
            },
            function (result, unused, next) {
                self.logger_.debug(message + ' succeed. Result: ' + 
                                   C.lang.reflect.inspect(result));
                
                message = 'Creating tag ' + params.name + ' with revision ' + 
                          result.value;
                self.logger_.debug(message + ' ...');
                action.data = params;
                action.data.revision = result.value;
                action.acquire('data.configuration.tag.create', next);
            }
        ], function (error, result) {
            if (error) {
                self.logger_.error(message + ' failed. Error: ' + 
                                   C.lang.reflect.inspect(error));
                action.error(error);
                return;
            }
            
            self.logger_.debug(message + ' succeed. Result: ' +
                               C.lang.reflect.inspect(result));
            action.done({ revision: action.data.revision });
        });
    };
    
    /**
     * Return the tag with the specified cretieria and oeprations.
     * TODO: add action.transfer/redirect to simple pass the action to
     * another handler instead of calling that handler and proxying the
     * result
     * 
     * @method read
     * @param {Action} action the reading action to be handled
     */
    TagHandler.prototype.read = function (action) {
        action.acquire('data.configuration.tag.read', function (error, result) {
            if (error) {
                action.error(error);
                return;
            }
            
            action.done(result);
        });
    };
    
    /**
     * Expand the specified tag to the related configurations (roles or nodes).
     * User can also provide a criteria to filter out the result.
     * 
     * @method expand
     * @param {Action} action the checkout action to be handled.
     */
    TagHandler.prototype.expand = function (action) {
        var params = action.data,
            self = this,
            message = null,
            revision = null,
            configurations = [];
        
        C.async.waterfall([
            function (next) { // reading the revision number for the specified 
                              // TAG
                message = 'Reading the revision number for TAG ' + params.tag;
                self.logger_.debug(message + ' ...');
                action.data = { 
                    criteria: { name: params.tag }
                };
                action.acquire('data.configuration.tag.read', next);
            },
            function (result, unused, next) { // reading the configuration collections
                
                self.logger_.debug(message + ' succeed. Revision: ' + 
                                   result.data[0].revision);
                                   
                revision = result.data[0].revision;
                message = 'Reading the configurations satisfy the user ' +
                          'specified criteria ' +  
                          C.lang.reflect.inspect(params.criteria) +
                          ' under the revision ' + revision;
                          
                self.logger_.debug(message + ' ...');
                
                if (params.criteria) {
                    params.criteria = { '$and': [
                        { 'revision': { '$lte': revision }},
                        params.criteria
                    ]};
                } else {
                    params.criteria = { 
                        'revision': { '$lte': revision }
                    };
                }
                
                action.data = {
                    criteria: params.criteria,
                    fields: { oid: '_id', revision: 1, name: 1 },
                    operations: { sort: { revision: -1 }},
                    by: 'name',
                    aggregation: {
                        revision: { '$first': 'revision' },
                        oid: { '$first': 'oid' }
                    }
                };
                // TODO: configuration handler provides this feature?
                action.acquire('data.configuration.group', next);
            },
            function (result, unused, next) {
                var ids = null;
                
                self.logger_.debug(message + ' succeed. Result: ' +
                                   C.lang.reflect.inspect(result));
                
                if (0 === result.affected) {
                    next(null, null, null);
                    return;
                }
                
                ids = result.data.map(function (item) { return item.oid; });
                message = 'Reading configuration objects whose id is in ' +
                          ids.toString();
                self.logger_.debug(message + ' ...');
                action.data = { criteria: { '_id': { '$in': ids }}};
                action.acquire('data.configuration.read', next);
            },
            function (result, unused, next) { // reading the history collections
                if (result) {
                    self.logger_.debug(message + ' succeed. Result: ' +
                                       C.lang.reflect.inspect(result));
                
                    // setup configuration dict based on current collection
                    configurations = result.data;
                }
                
                // TODO: verify if it's necessary to query the history collection
                
                // restore the same param for grouping the configuration history
                // since the original action.data has been modified
                action.data = {
                    criteria: params.criteria,
                    fields: { oid: '_id', revision: 1, name: 1 },
                    operations: { sort: { revision: -1 }},
                    by: 'name',
                    aggregation: {
                        revision: { '$first': 'revision' },
                        oid: { '$first': 'oid' }
                    }
                };
                
                message = 'Reading the history configurations satisfy the ' + 
                          'user specified criteria ' +  
                          C.lang.reflect.inspect(params.criteria) +
                          ' under the revision ' + revision;
                
                self.logger_.debug(message + ' ...');
                action.acquire('data.configuration-history.group', next);
            },
            function (result, unused, next) {
                var ids = null;
                
                self.logger_.debug(message + ' succeed. Result: ' +
                                   C.lang.reflect.inspect(result));
                //
                if (0 === result.affected) {
                    next(null, null, null);
                    return;
                }
                
                ids = result.data.map(function (item) { return item.oid; });
                message = 'Reading history configuration objects whose id is' +
                          ' in ' + ids.toString();
                self.logger_.debug(message + ' ...');
                action.data = { criteria: { '_id': { '$in': ids }}};
                action.acquire('data.configuration-history.read', next);           
            },
            function (result, unused, next) {
                var unique = {};
                
                if (result) {
                    self.logger_.debug(message + ' succeed. Result: ' +
                                       C.lang.reflect.inspect(result));
                
                    // setup configuration dict based on current collection
                    configurations = configurations.concat(result.data || []);
                }
                
                configurations = configurations.filter(function (item) {
                    if (unique[item.name]) {
                        return false;
                    }
                
                    unique[item.name] = true;
                    return true;
                });
                
                next();
            }
        ], function(error, result) {
            
            if (error) {
                self.logger_.error(message + ' failed. Error: ' + 
                                   C.lang.reflect.inspect(error));
                action.error(error);
                return;
            }
            
            self.logger_.debug(message + ' succeed. Result: ' +
                               C.lang.reflect.inspect(configurations));
            action.done({ 
                affected: configurations.length,
                data: configurations
            });
        });
    };
    
    C.namespace('caligula.handlers.configuration').TagHandler = TagHandler;

}, '0.0.1', { requires: ['caligula.handlers.base'] });
