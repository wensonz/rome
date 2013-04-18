/**
 *
 * @module caligula.components.configuration.generator
 */
Condotti.add('caligula.components.configuration.generator', function (C) {
    /**
     *
     * @class GenerationHandler
     * @constructor
     * @extends Handler
     * @param {}
     */
    function GenerationHandler() {
        /* inheritance */
        this.super();
    }

    C.lang.inherit(GenerationHandler, C.caligula.handlers.Handler);

    /**
     * Generate the configuration for the specified node.
     *
     * @method call
     * @param {Action} action the generation action to be handled
     */
    GenerationHandler.prototype.call = function(action) {
        // steps:
        // 1. read the node with the tag
        // 2. read the roles node includes with the tag
        // 3. execute the pre-filters
        // 4. merge
        // 5. execute the post-filters
        // 6. generate with all kinds of resource generators
        // 7. create RPM?
        /*
        {
            name: ${role name},
            revision: ${revision},
            path: 'data.configuration.files.vhost',
            data:{
                files: [],
                packages: [],
                services: []
                
            }
        }
        */
        var self = this,
            params = action.data,
            message = null,
            revision = null;

        // TODO: check the params
        C.async.waterfall([
            function (next) { // reading revision number from TAG
                message = 'Reading the revision number from TAG ' + params.tag;
                self.logger_.debug(message + ' ...');
                action.data = { name: params.tag };
                action.acquire('configuration.tag.read', next);
            },
            function (result, next) { // Reading the node information
                self.logger_.debug(message + ' succeed. Revision: ' + 
                                   result.data.revision);
                message = 'Reading the node information @revision ' + result.
            }
        ], function (error, result) {});
    };

    C.namespace('caligula.handlers.configuration').GenerationHandler = GenerationHandler;

}, '0.0.1', { requires: ['caligula.handlers.base'] });
