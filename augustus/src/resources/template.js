/**
 * This module contains the implementation of template resource processor, 
 * which is designed to describe a configuration file generated from dust.js
 * template.
 * 
 * @module caligula.components.configuration.resources.template
 */
Condotti.add('caligula.components.configuration.resources.template', function (C) {
    
    /**
     * This TemplateResourceProcessor is designed to describe a configuration
     * file generated from a dust.js template, which is to be deployed onto the 
     * target node. A typical template resource is defined as following:
     * 
     * '/etc/http.conf': {
     *     'type': 'template', // indicate this resource is a tempate resource
     *     'path': '/etc/http.conf', // the path where the file is to be located
     *                               // on the target servers
     *     'owner': 'nobody',
     *     'group': 'nobody',
     *     'mode': '0755',
     *     'template': '${dust.js template content}'
     * }
     * 
     * When generating, this kind of resource creates two files, one for sls,
     * the other one is the rendered configuration file. The sls file generated
     * contains a "file.managed" resource with its source property set to be
     * the location of the rendered configuration file based on the "salt"
     * protocol
     * 
     * @class TemplateResourceProcessor
     * @constructor
     * @extends ResourceProcessor
     */
    function TemplateResourceProcessor () {
        /* inheritance */
        this.super();
    }
    
    C.lang.inherit(TemplateResourceProcessor, 
                   C.caligula.configuration.resources.ResourceProcessor);
    
    /**
     * Render the template and generate the description sls for it based on the
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
    TemplateResourceProcessor.prototype.process = function (action, name, 
                                                            resource, context, 
                                                            directory, callback) {
        var self = this,
            logger = C.logging.getStepLogger(this.logger_),
            params = action.data;

        C.async.waterfall([
            function (next) { // Create the directory
                var mkdirp = C.require('mkdirp');
                directory = C.natives.path.resolve(directory, name);
                
                logger.start('Creating the directory ' + directory + 
                             ' to keep the generated configuration file');
                mkdirp(directory, next);
            },
            function (made, next) { // render the dust.js template
                var dust = C.require('dust'),
                    compiled = null;
                
                logger.done(made);
                logger.start('Rendering template for resource ' + name);
                compiled = dust.compile(resource.template, name);
                dust.loadSource(compiled);
                dust.render(name, context, next);
            },
            function (output, next) { // save the generated content into file
                var path = null;
                
                logger.done(output);
                
                path = C.natives.path.resolve(
                    directory, C.natives.path.basename(resource.path)
                );
                
                logger.start('Saving the generated content into file ' + path);
                C.natives.fs.writeFile(path, output, next);
            },
            function (next) {
                var salt = {},
                    backup = {},
                    managed = [],
                    path = null;
                
                logger.done();
                
                // clone = C.lang.clone(resource);
                backup.path = resource.path;
                backup.type = resource.type;
                backup.template = resource.template;
                
                delete resource.path;
                delete resource.type;
                delete resource.template;
                resource.source = 'salt://' + name + '/' + 
                                  C.natives.path.basename(backup.path);
                
                managed = Object.keys(resource).map(function (key) {
                    var item = {};
                    item[key] = resource[key];
                    return item;
                });
                
                managed.push({'makedirs': true});
                
                salt[backup.path] = { 'file.managed': managed };
                
                delete resource.source;
                resource.path = backup.path;
                resource.type = backup.type;
                resource.template = backup.template;
                
                path = C.natives.path.resolve(directory, 'init.sls');
                logger.start('Saving configuration ' + 
                             C.lang.reflect.inspect(salt) +
                             ' into file ' + path);
                
                C.natives.fs.writeFile(path, JSON.stringify(salt, null, 4), 
                                       next);
            }
        ], function (error) {
            action.data = params;

            if (error) {
                logger.error(error);
                callback(error);
                return;
            }

            logger.done();
            callback();
        });
    };
    
    C.namespace('caligula.configuration.resources').TemplateResourceProcessor = TemplateResourceProcessor;
    
    
}, '0.0.1', { requires: [ 'caligula.components.configuration.resources.base' ] });
