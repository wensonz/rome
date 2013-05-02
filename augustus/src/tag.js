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
                    next(params.revision);
                    return;
                }
                
                action.data = { 'name': 'revision', 'value': 0 };
                action.acquire('counter.increase', next);
            },
            function (revision, meta, next) {
                self.logger_.debug(message + ' succeed. Revision: ' + revision);
                
                message = 'Creating tag ' + params.name + ' with revision ' + revision;
                self.logger_.debug(message + ' ...');
                action.data = params;
                action.data.revision = revision;
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
            configurations = null;
        
        C.async.waterfall([
            function (next) { // reading the revision number for the specified 
                              // TAG
                message = 'Reading the revision number for TAG ' + params.tag;
                self.logger_.debug(message + ' ...');
                action.data = { name: params.tag };
                action.acquire('data.configuration.tag.read', next);
            },
            function (result, next) { // reading the configuration collections
                // TODO: check if the tag exist
                self.logger_.debug(message + ' succeed. Revision: ' + 
                                   result.data.revision);
                                   
                revision = result.data.revision;
                message = 'Reading the configurations satisfy the user ' +
                          'specified criteria' +  
                          C.lang.reflect.inspect(params.criteria) +
                          ' under the revision ' + revision;
                          
                self.logger_.debug(message + ' ...');
                
                if (params.criteria) {
                    params.criteria = { '$and': [
                        { 'revision': { '$le': revision }},
                        params.criteria
                    ]};
                } else {
                    params.criteria = { 
                        'revision': { '$le': revision }
                    };
                }
                
                action.data = {
                    criteria: params.criteria,
                    operations: { sort: { revision: -1 }},
                    by: name,
                    aggregation: {
                        revision: { '$first': 'revision' }
                    }
                };
                // TODO: configuration handler provides this feature?
                action.acquire('data.configuration.group', next);
            },
            function (result, next) { // reading the history collections
                self.logger_.debug(message + ' ...');
                
                // setup configuration dict based on current collection
                configurations = result.data;
                
                message = 'Reading the history configurations satisfy the ' + 
                          'user specified criteria' +  
                          C.lang.reflect.inspect(params.criteria) +
                          ' under the revision ' + revision;
                
                self.logger_.debug(message + ' ...');
                action.acquire('data.configuration-history.group', next);
            }
        ], function(error, result) {
            var unique = {};
            
            if (error) {
                self.logger_.error(message + ' failed. Error: ' + 
                                   C.lang.reflect.inspect(error));
                action.error(error);
                return;
            }
            
            // merge the two collections
            configurations = configurations.concat(result.data);
            configurations = configurations.filter(function (item) {
                if (unique[item.name]) {
                    return false;
                }
                
                unique[item.name] = true;
                return true;
            });
            
            action.done({ 
                affected: configurations.length,
                data: configurations
            });
        });
    };
    
    C.namespace('caligula.handlers.configuration').TagHandler = TagHandler;

}, '0.0.1', { requires: ['caligula.handlers.base'] });

