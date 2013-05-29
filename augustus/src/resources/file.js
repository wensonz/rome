/**
 * This module contains the implementation of file resource processor, which is
 * designed to describe a plain configuration file.
 * 
 * @module caligula.components.configuration.resources.file
 */
Condotti.add('caligula.components.configuration.resources.file', function (C) {
    
    /**
     * This FileResourceProcessor is designed to describe a plain configuration
     * file to be deployed onto the target node. A typical file resource is 
     * expected to be constructed like the following sample:
     * 
     * '/etc/http.conf': {
     *     'type': 'file', // indicate this resource is a file resource
     *     'path': '/etc/http.conf', // the path where the file is to be located
     *                               // on the target servers
     *     'owner': 'nobody',
     *     'group': 'nobody',
     *     'mode': '0755',
     *     'source': 'file://http.conf.default'
     * }
     *
     * Besides the 3 kind of file sources, salt, http and ftp, an additional
     * 'file' is also supported, which utilize the file management API to host
     * the static configuration files. The format for this kind of source is:
     *
     *    'source': 'file://{name of the file in file management API}'
     *
     * When processing this kind of source, this processor query the file
     * management API with the parsed name from the source string, and find out
     * the url to fetch that file via "download" API. After that the resource is
     * rebuilt with a new HTTP source string contains the url.
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
    FileResourceProcessor.prototype.process = function (action, name, resource, 
                                                        context, directory, 
                                                        callback) {
        var self = this,
            logger = C.caligula.logging.getStepLogger(this.logger_),
            params = action.data;

        C.async.waterfall([
            function (next) { // Read the file object if resource.source starts
                              // with "file://"
                var protocol = 'file://',
                    parsed = null;

                parsed = resource.source.substring(0, protocol.length);
                if (protocol !== parsed) {
                    self.logger_.debug('Parsed protocol from source ' + 
                                        resource.source + ' is "' + parsed +
                                        '", but not "file://"');
                    next(null, null);
                    return;
                }

                logger.start('Reading the source ' + resource.source + 
                             ' from the file management API');
                action.data = { 
                    name: resource.source.substring(protocol.length),
                    dryrun: true
                };
                action.acquire('file.download', next);
            },
            function (result, next) {
                var salt = {},
                    clone = null,
                    managed = [],
                    path = null;

                logger.done(result);
                
                clone = C.lang.clone(resource);

                delete clone.path;
                delete clone.type;
                clone.source = result.url;
                clone.source_hash = 'md5=' + result.md5;

                managed = Object.keys(resource).map(function (key) {
                    return [key, resource[key]];
                });
                managed.push(['makedirs', 'True']);

                salt[resource.path] = { 'file.managed': managed };
                
                path = C.natives.path.resolve(directory, name + '.sls');
                logger.start('Saving configuration ' + 
                             C.lang.reflect.inspect(salt) +
                             ' into file ' + path);
                
                C.natives.fs.writeFile(path, JSON.stringify(salt), 
                                       function (error) {
                    if (error) {
                        // TODO: refactor the message?
                        next(new C.caligula.errors.InternalServerError(
                            error.message
                        ));
                        return;
                    }
                    next();
                });
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
    
    C.namespace('caligula.configuration.resources').FileResourceProcessor = FileResourceProcessor;
    
    
}, '0.0.1', { requires: [ 'caligula.components.configuration.resources.base' ] });
