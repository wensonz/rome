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
     */
    function FileResourceProcessor () {
        /* inheritance */
        this.super();
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
    FileResourceProcessor.prototype.process = function (name, resource, context, 
                                                        path, callback) {
        
    };
    
    C.namespace('caligula.configuration.resources').FileResourceProcessor = FileResourceProcessor;
    
    
}, '0.0.1', { requires: [ 'caligula.components.configuration.resources.base' ] });
