/**
 * This module contains the implementation of package resource processor, which
 * is designed to describe a software package, like rpm.
 *
 * @module module-name
 */

Condotti.add('caligula.components.configuration.resources.package', function (C) {
    /**
     * @class PackageResourceProcessor
     * @constructor
     * @extends ResourceProcessor
     * @param {object} config the config object for this processor.
     */
    function PackageResourceProcessor (config) {
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
    C.lang.inherit(PackageResourceProcessor,
                    C.caligula.configuration.resources.ResourceProcessor);

    /**
     * @method process
     * @param {object} resource the resource object to be processed
     * @param {object} context the context data associated with this processing
     * @param {function} callback cb(error, result)
     */
    PackageResourceProcessor.prototype.process = function (action, resourceName,
            resource, context, configurations, callback) {

        var self = this,
            message = null,
            sls = {},
            nodeName = action.data.node,
            resourceName = resourceName.replace(/\//g, '_'),
            mkdirp = C.require('mkdirp'),
            resourceRoot = this.root_ + '/' + nodeName + '/' + resourceName,
            metaFilePath = resourceRoot + '/init.sls';

        C.async.waterfall([
            function (next) {
                message = 'package, Make resource direcotry ' + resourceRoot;
                self.logger_.debug(message + '...');
                mkdirp(resourceRoot, next);
            },
            function (made, next) {
                self.logger_.debug(message + ' succeed, Result: ' + made);

                sls[resourceName] = {'pkg.installed': []};
                Object.keys(resource).forEach(function (k) {
                    var opt = {};
                    if (['type'].indexOf(k) >= 0) {
                        return;
                    }
                    opt[k] = resource[k];
                    sls[resourceName]["pkg.installed"].push(opt);
                });

                massage = "Read package path from package.read API...";
                action.data = {
                    criteria: {
                        resourceName: resource.name,
                        revision: resource.revision
                    }
                };

                action.acquire('package.read', next);
            },
            function (result, meta, next) {
                self.logger_.debug(message + ' succeed, Result: ' + result);

                // salt will check the name & version of the package, then
                // download and install new package if necessary.
                sls[resourceName]["pkg.installed"]
                    .push({source: result.result.data.path});

                message = 'package, Write meta file to disk';
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

    C.namespace('caligula.configuration.resources')
        .PackageResourceProcessor = PackageResourceProcessor;

}, '0.0.1', {requires: ['caligula.components.configuration.resources.base']});
