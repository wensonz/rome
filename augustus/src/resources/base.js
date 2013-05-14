/**
 * This module defines the behaviours a resource processor is supposed to have
 * in class ResourceProcessor.
 *
 * @module caligula.components.configuration.resources.base
 */
Condotti.add('caligula.components.configuration.resources.base', function (C) {
    
    /**
     * This ResourceProcessor defines the behaviours a resource processor is
     * supposed to have. It's designed to be the ancestor of all resource
     * processor types, such as template resource processor.
     * 
     * @class ResourceProcessor
     * @constructor
     */
    function ResourceProcessor () {
        /**
         * The logger instance for this processor
         * 
         * @property logger_
         * @type Logger
         */
        this.logger_ = C.logging.getObjectLogger(this);
    }
    
    /**
     * Process the resource with the passed-in context data
     * 
     * @method process
     * @param {Object} resource the resource object to be processed
     * @param {Object} context the context data associated with this processing
     * @param {Function} callback the callback function to be invoked after the
     *                            resource has been successfully processed, or
     *                            some unexpected error occurs. The signature of
     *                            the callback is 'function (error, result) {}'
     */
    ResourceProcessor.prototype.process = function (resource, context, callback) {
        callback(new C.errors.NotImplementedError('This process method is not' +
                                                  ' implemented here, and is ' +
                                                  'expected to be overwritten' +
                                                  ' in the child classes.'));
    };
    
    C.namespace('caligula.configuration.resources').ResourceProcessor = ResourceProcessor;
    
}, '0.0.1', { requires: [] });
