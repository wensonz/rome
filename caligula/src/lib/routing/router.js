/**
 * This module contains the implementation of the Router class, which routes
 * the contextualized action instance from the incoming request to the correct
 * handler based on its configuration and the routing tree to complete the
 * requests.
 *
 * @module caligula.routing.router
 */
Condotti.add('caligula.routing.router', function (C) {
    
    C.namespace('caligula.routing').ROOT = '';
    
    /**
     * This Router class is designed to be able to route the passed-in action
     * instance, which is contextualized from the incoming request, to the
     * correct handler based on its configuration and the constructed routing
     * tree, in order to complete the request. This router uses a routing
     * tree and takes the action name as a tree path, which is expected to lead
     * to leaf object which is an action handler to handle the requested action.
     * For now, there are two kinds of handlers, local and HTTP, which 
     * indicate the handler on the same server this router is running on,
     * or on a remote HTTP server respectively. For more detail about the
     * handlers, please check out the source code under "handler" directory.
     *
     * @class Router
     * @constructor
     * @param {Object} config the config for this router to create routing tree
     * @param {DottiFactory} factory the dotti factory used to create objects in
     *                               routing tree as tree nodes
     */
    function Router (config, factory) {
        
        /**
         * The config object for this router to create routing tree
         *
         * @property config_
         * @type Object
         */
        this.config_ = config;
        
        /**
         * The root of the routing tree which is used to search for the handler
         * for an action
         * 
         * @property root_
         * @type Object
         * @deafult null
         */
        this.root_ = null;
        
        /**
         * The dotti factory used to create objects for routing tree as tree
         * nodes
         * 
         * @property factory_
         * @type DottiFactory
         */
        this.factory_ = factory;
        
        
        /**
         * The logger instance
         * 
         * @property logger_
         * @type Logger
         */
        this.logger_ = C.logging.getObjectLogger(this);
        
        /* initialize */
        this.initialize_();
    }
    
    /**
     * Initialize the routing tree for this router by creating the corresponding 
     * tree nodes according to the configuration with the help of dotti factory
     *
     * @method initialize_
     */
    Router.prototype.initialize_ = function () {
        var self = this,
            root = null;
        
        root = this.config_[C.caligula.routing.ROOT];
        this.root_ =  root ? this.factory_.get(root) : {};
        
        Object.keys(this.config_).sort().forEach(function (path) {
            var index = path.lastIndexOf('.'),
                name = null,
                parent = self.root_;
            
            if (path === C.caligula.routing.ROOT) {
                return;
            }
            
            if (index >= 0) {
                parent = C.namespace.call(self.root_, path.substring(0, index));
                name = path.substring(index + 1);
            } else {
                name = path;
            }
            
            parent[name] = self.factory_.get(self.config_[path]);
        });
    };
    
    /**
     * Re-configure the router with the specified configuration object, which is
     * supposed to cause the routing tree is re-constructed
     *
     * @method configure
     * @param {Object} config the new config object for this router
     */
    Router.prototype.configure = function (config) {
        C.lang.merge(this.config_, config);
        
        this.root_ = null;
        
        this.initialize_();
    };
    
    
    /**
     * Route the passed-in action to the correct handler based on its 
     * configuration and the routing tree to complete the further processing.
     * Note that once the correct handler is found in the routing tree, it is
     * to be invoked immediately by the router to complete the required action.
     * Note that the routing strategy is borrowed from the router of CherryPy,
     * besides that the one in CherryPy routes based on the URI of the request,
     * however this router routes based on the name of the action, which is
     * normally converted from the URL of the HTTP request for the HttpAction.
     * So like CherryPy, when looking up the required action, the router travels
     * down from the root of the routing tree with the name of the action as the
     * tree path. Once it stops, the left part of the action name is to be 
     * splitted in to argument list and saved to the "arguments" property of the
     * action object. 
     *
     * @method route
     * @param {Action} action the action to be routed
     */
    Router.prototype.route = function (action) {
        var tokens = action.name.split('.'),
            index = 0,
            length = tokens.length,
            handler = null,
            next = this.root_,
            token = null;
        
        if (action.name !== C.caligula.actions.DEFAULT) {
            while (next && (index < length)) {
                handler = next;
                token = tokens[index];
                next = handler[token];
                index += 1;
            }
        }
        
        if (!next) {
            if (C.lang.reflect.isFunction(handler.default)) { // "default"
                                                              // handler
                // the handler is supposed to handle all thrown errors
                action.arguments = tokens.slice(index - 1);
                handler.default.call(handler, action);
            } else {
                action.error(C.caligula.errors.ActionHandlerNotFoundError(
                    action, token
                ));
            }
        } else {
            if (C.lang.reflect.isFunction(next)) {
                next.call(handler, action);
            } else if (next && C.lang.reflect.isFunction(next.call)) {
                next.call(action);
            } else {
                action.error(C.caligula.errors.ActionHandlerNotCallableError(
                    action
                ));
            }
        }
    };
    
    C.namespace('caligula.routing').Router = Router;
    
}, '0.0.1', { requires: [] }); 
// TODO: resolve the dependency on caligula.errors
