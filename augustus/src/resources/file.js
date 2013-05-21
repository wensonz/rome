/**
 * This module contains the implementation of file resource processor, which is
 * designed to describe a plain configuration file.
 * 
 * @module caligula.components.configuration.resources.file
 */
Condotti.add('caligula.components.configuration.resources.file', function (C) {
    
    /**
     * This FileResourceProcessor is designed to describe a plain configuration
     * file to be deployed onto the target node
     * 
     * @class FileResourceProcessor
     * @constructor
     * @extends ResourceProcessor
     * @param {Object} config the config object for this processor
     */
    function FileResourceProcessor (config) {
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
    
    C.lang.inherit(FileResourceProcessor, 
                   C.caligula.configuration.resources.ResourceProcessor);
    
    /**
     * Generate the description file for the plain configuration file with the 
     * passed-in resource and context.
     * 
     * @method process
     * @param {Object} resource the resource object to be processed
     * @param {Object} context the context data associated with this processing
     * @param {Function} callback the callback function to be invoked after the
     *                            resource has been successfully processed, or
     *                            some unexpected error occurs. The signature of
     *                            the callback is 'function (error, result) {}'
     */
    FileResourceProcessor.prototype.process = function (resource, context, 
                                                        callback) {
        var name = name || 'resourceName';
        var self = this,
            message = null,
            nodeName = 'nodeName',
            mkdirp = C.require('mkdirp'),
            resourceRoot = this.root_ + '/' + nodeName + '/' + name,
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

                sls[resource.path] = {'file.managed': []};
                Object.keys(resource).forEach(function (k) {
                    var opt = {};
                    if (['path', 'content', 'type'].indexOf(k) >= 0) {
                        return;
                    }
                    opt[k] = resource[k];
                    sls[resource.path]["file.managed"].push(opt);
                });
                sls[resource.path]["file.managed"].push({"makedirs": "True"});

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

    C.namespace('caligula.configuration.resources').FileResourceProcessor = FileResourceProcessor;
}, '0.0.1', { requires: [ 'caligula.components.configuration.resources.base' ] });
