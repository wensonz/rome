/**
 * This module contains the implementation of package resource processor, 
 * which is designed to describe a list of packages to be installed.
 * 
 * @module caligula.components.configuration.resources.package
 */
Condotti.add('caligula.components.configuration.resources.package', function (C) {
    
    /**
     * This PackageResourceProcessor is designed to describe a list of packages
     * to be installed in the target nodes. A typical package resource is 
     * defined as following:
     * '${resource name}': { // such as "mypkgs"
     *     'type': 'package', // indicate this resource is a package resource
     *     'name': '${package name}',
     *     'version': '${package version}'
     * }
     * 
     * @class PackageResourceProcessor
     * @constructor
     * @extends ResourceProcessor
     */
    function PackageResourceProcessor () {
        /* inheritance */
        this.super();
    }
    
    C.lang.inherit(PackageResourceProcessor, 
                   C.caligula.configuration.resources.ResourceProcessor);
    
    /**
     * Generate the description sls for it based on the
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
    PackageResourceProcessor.prototype.process = function (action, name, 
                                                           resource, context, 
                                                           directory, callback) {
        var self = this,
            logger = C.logging.getStepLogger(this.logger_),
            params = action.data;
        
        C.async.waterfall([
            function (next) { // read package info
                logger.start('Querying the package info about ' + 
                             resource.name + '@' + resource.version);
                
                
                action.data = { criteria: {
                    name: resource.name,
                    version: resource.version
                }};
                action.acquire('package.read', next);
            },
            function (result, unused, next) { // save the generated content into sls
                var path = null,
                    salt = {};
                
                logger.done(result);
                
                logger.start('Verifying if the package ' + resource.name + '@' +
                             resource.version + ' exists');
                
                if (0 === result.affected) {
                    next(new C.caligula.errors.PackageNotFoundError(
                        'Required package ' + resource.name + '@' + 
                        resource.version + ' does not exist.'
                    ));
                    return;
                }

                logger.done();
                
                salt[resource.name] = {
                    'pkg.installed': [
                        { 'skip_verify': true },
                        { 'version': resource.version }
                    ]
                };
                
                path = C.natives.path.resolve(directory, name + '.sls');
                
                logger.start('Saving the generated content ' + 
                             C.lang.reflect.inspect(salt) +
                             ' into file ' + path);
                             
                C.natives.fs.writeFile(
                    path, JSON.stringify(salt, null, 4), next
                );
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
    
    C.namespace('caligula.configuration.resources').PackageResourceProcessor = PackageResourceProcessor;
    
    
}, '0.0.1', { requires: [ 'caligula.components.configuration.resources.base' ] });
