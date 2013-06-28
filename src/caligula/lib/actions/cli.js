/**
 * This module contains the implementation of the CliAction class, which is
 * the child class of Action, and is used when handling command line request.
 *
 * @module caligula.actions.cli
 */
Condotti.add('caligula.actions.cli', function (C) {
    /**
     * This CliAction class is the child class of Action, and is used to
     * represent the incoming command line request internally. It is generated 
     * by the CliContextualizer based on the incoming request to be processed 
     * and is a sandbox that is supopsed to keep all related data, just like the 
     * "request" structure in Apache module development.
     *
     * @class CliAction
     * @constructor
     * @param {String} name the name of the action
     * @param {Router} router the router which is to handle this action
     * @param {WriteStream} output the writable stream where the normal output
     *                             is to be written to
     * @param {WriteStream} error the writable stream where the error output
     *                            is to be written to
     */
    function CliAction (router, output, error) {
        /* inheritance */
        this.super(router);
        
        /**
         * The writable stream used to write normal output to
         * 
         * @property output
         * @type WriteStream
         */
        this.output = output;
        
        /**
         * The writable stream used to write error output to
         * 
         * @property error
         * @type WriteStream
         */
        this.error = error;
    }
    
    C.lang.inherit(CliAction, C.caligula.actions.Action);
    
    /**
     * End the current request processing flow, and write the result to the
     * user-specified output stream and exit the porcess with corresponding
     * exit code, which may be specified by user or 0 by default.
     * Note that this method is expected to be called when the
     * processing successfully completes by the correct handler, otherwise
     * method "error" should be called instead.
     *
     * @method done
     * @param {Object} data the data to be returned to the client
     * @param {Object} meta the meta data that may affect some property, such as
     *                      the exit code, etc. 
     */
    CliAction.prototype.done = function (data, meta) {
        // TODO: check the data
        var code = (meta && meta.code) || 0;
            
        if (C.lang.reflect.getObjectType(data) !== String) {
            data = JSON.stringify(data, null, 4);
        }
        
        this.output.write(data);
        C.process.exit(code);
    };
    
    /**
     * The same functionality with method "done", except that it is expected to
     * be called when some error occurs during the request processing.
     *
     * @method error
     * @param {Error} error the error object indicates what happened when this
     *                      error occurred
     * @param {Object} meta the meta data for this error output
     */
    CliAction.prototype.error = function (error, meta) {
        var code = (meta && meta.code) || error.code || 1;
        
        // TODO: check the type of error
        
        this.error.write(error.message);
        C.process.exit(code);
    };

    /**
     * Clone this command line action
     *
     * @method clone
     * @return {CliAction} the action cloned
     */
    CliAction.prototype.clone = function () {
        var action = new CliAction(this.router_),
            key = null;
        
        for (key in this) {
            // clone the properties belongs to this action, but not private
            if (this.hasOwnProperty(key) && ('_' !== key[key.length - 1])) {
                action[key] = this[key];
            }
        }
        
        return action;
    };
    
    C.namespace('caligula.actions').CliAction = CliAction;
    
    
}, '0.0.1', { requires: ['caligula.actions.base'] });
