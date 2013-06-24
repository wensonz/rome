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
     *     'packages': {
     *        '${package name}': '${package version}',
     *        ...
     *     }
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
            params = action.data,
            names = Object.keys(resource.packages);
        
        C.async.waterfall([
            function (next) { // read package links
                logger.start('Querying the fetching URLs for packages ' + 
                             C.lang.reflect.inspect(resource.packages));
                
                C.async.mapSeries(names, function (name, next) {
                    action.data = {
                        name: name, 
                        version: resource.packages[name],
                        dryrun: true
                    };
                    action.acquire('package.fetch', next);
                }, next);
            },
            function (result, next) { // save the generated content into sls
                var path = null,
                    sources = [],
                    salt = {};
                
                logger.done(result);
                
                names.forEach(function (name, index) {
                    var item = {};
                    item[name] = result[index].url;
                    sources.push(item);
                });
                salt[name] = {'pkg.installed': [{'sources': sources }]};
                
                
                path = C.natives.path.resolve(directory, name + '.sls');
                
                logger.start('Saving the generated content ' + 
                             C.lang.reflect.inspect(salt) +
                             + ' into file ' + path);
                             
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
    
    C.namespace('caligula.configuration.resources').TemplateResourceProcessor = TemplateResourceProcessor;
    
    
}, '0.0.1', { requires: [ 'caligula.components.configuration.resources.base' ] });
