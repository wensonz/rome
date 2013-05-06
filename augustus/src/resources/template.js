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
    TemplateResourceProcessor.prototype.process = function (resource, context, 
                                                            callback) {
        callback();
    };
    
    C.namespace('caligula.configuration.resources').TemplateResourceProcessor = TemplateResourceProcessor;
    
}, '0.0.1', { requires: [ 'caligula.components.configuration.resources.file' ] });
