/**
 * This module contains the implementation of the template resource processor,
 * which is designed to render the required configuration file with dust.js
 * template engine and the context data.
 *
 * @module caligula.components.configuration.resources.template
 */
Condotti.add('caligula.components.configuration.resources.template', function (C) {
    
    /**
     * This TemplateResourceProcessor is designed to process the resource which
     * is maintained in template and data, and is to be rendered in dust.js
     * when generating the configuration file.
     * 
     * @class TemplateResourceProcessor
     * @constructor
     * @extends FileResourceProcessor
     * @param {Object} config the config object for this processor
     */
    function TemplateResourceProcessor (config) {
        /* inheritance */
        this.super(config);

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
    
    C.lang.inherit(TemplateResourceProcessor, 
                   C.caligula.configuration.resources.FileResourceProcessor);
    
    /**
     * Generate the description file and the configuration file with the 
     * passed-in template resource and context via the dust.js template engine.
     * 
     * @method process
     * @param {Object} resource the resource object to be processed
     * @param {Object} context the context data associated with this processing
     * @param {Function} callback the callback function to be invoked after the
     *                            resource has been successfully processed, or
     *                            some unexpected error occurs. The signature of
     *                            the callback is 'function (error, result) {}'
     */
    TemplateResourceProcessor.prototype.process = function (resource,
                                                            context, callback) {
        var name = name || 'resourceName';
        var self = this,
            message = null,
            nodeName = 'nodeName',
            dust = C.require('dust'),
            mkdirp = C.require('mkdirp'),
            content = null,
            F = C.caligula.configuration.resources.FileResourceProcessor,
            resourceRoot = this.root_ + '/' + nodeName + '/' + name,
            contentFile = resource.path.replace(/\//g, '_'),
            contentFilePath = resourceRoot + "/" + contentFile;

        content = resource.content.replace(/\n/g, '{~n}').replace(/ /g, '{~s}');
        eval(dust.compile(content, name));

        C.async.waterfall([
            function (next) {
                message = 'Make resource directory ' + resourceRoot;
                self.logger_.debug(message + '...');
                mkdirp(resourceRoot, next);
            },
            function (made, next) { // render
                self.logger_.debug(message + ' succeed. Result: ' + made);

                message = 'Render template resource using dust';
                self.logger_.debug(message + '...');
                dust.render(name, context, next);
            },
            function (out, next) { // save files
                console.log(out);
                self.logger_.debug(message + ' succeed.');

                message = 'Write content file to disk';
                self.logger_.debug(message + '...');
                C.natives.fs.writeFile(contentFilePath, out, next);
            },
            function (next) {
                self.logger_.debug(message + ' succeed.');

                resource.source = 'salt://' + contentFile;

                message = 'Call FileResourceProcessor to process meta file';
                self.logger_.debug(message + '...');
                F.prototype.process.call(self, resource, context, next);
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
    
    C.namespace('caligula.configuration.resources').TemplateResourceProcessor = TemplateResourceProcessor;
    
}, '0.0.1', { requires: [ 'caligula.components.configuration.resources.file' ] });
