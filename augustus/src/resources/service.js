/**
 * This module contains the implementation of service resource processor, which
 * is designed to describe a service(running programe)
 *
 * @module caligula.components.configuration.resources.service
 */
Condotti.add('caligula.components.configuration.resources.service', function (C) {
    
    /**
     *
     * @class ServiceResourceProcessor
     * @constructor
     * @extends ResourceProcessor
     * @param {object} config config object for this resource handler
     */
    function ServiceResourceProcessor (config) {
        /* inheritance */
        this.super();
        
        /**
         * The config object for this processor
         * 
         * @property config_
         * @type Object
         * @default {}
         */
        this.config_ = config || {};
        
        /**
         * The root directory on the file system where the generated description
         * file is to be saved.
         * 
         * @property root_
         * @type String
         * @default '/srv/salt'
         */
        this.root_ = this.config_.root || '/srv/salt';
    }

    C.lang.inherit(ServiceResourceProcessor,
        C.caligula.configuration.resources.ResourceProcessor);

    /**
     * Generate the description file for service with passed-in resource and
     * context
     * 
     * @method process
     * @param {Action} action the action causes this processor to be executed
     * @param {String} resourceName the name of the resource to be processed
     * @param {Object} resource the resource object to be processed
     * @param {Object} context the context data associated with this processing
     * @param {Array} configurations the list of configurations related with
     *                               this generation
     * @param {Function} callback the callback function to be invoked after the
     *                            resource has been successfully processed, or
     *                            some unexpected error occurs. The signature of
     *                            the callback is 'function (error, result) {}'
     */
    ServiceResourceProcessor.prototype.process = function (action, resourceName,
            resource, context, configurations, callback) {

        var self = this,
            message = null,
            nodeName = action.data.node,
            resourceName = resourceName.replace(/\//g, '_'),
            mkdirp = C.require('mkdirp'),
            resourceRoot = this.root_ + '/' + nodeName + '/' + resourceName,
            metaFilePath = resourceRoot + '/init.sls';

        C.async.waterfall([
            function (next) {
                message = 'Make resource direcotry ' + resourceRoot;
                self.logger_.debug(message + '...');
                mkdirp(resourceRoot, next);
            },
            function (made, next) {
                var sls = {};

                self.logger_.debug(message + ' succeed, Result: ' + made);

                sls[resourceName] = {'service': [
                    'running',
                    {'enable': true},
                    {'reload': true}]};

                message = 'Write meta file to disk';
                self.logger_.debug(message + '...');
                C.natives.fs.writeFile(metaFilePath, JSON.stringify(sls), next);
            }
        ], function (err, result) {
            if (err) {
                self.logger_.debug(message + ' faild. Error: ' + 
                    C.lang.reflect.inspect(err));
            }
            self.logger_.debug(message + ' succeed. Result: ' + 
                    C.lang.reflect.inspect(result));
            callback(err, result);
        });
    };

    C.namespace('caligula.configuration.resources').ServiceResourceProcessor = ServiceResourceProcessor;
}, '0.0.1', { requires: [ 'caligula.components.configuration.resources.base' ] });
