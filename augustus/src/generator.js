/**
 * This module contains the definition of the abstract base of the generator,
 * which is designed to generate the configurations for a specified node.
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
            name: ${role/node name},
            revision: ${revision},
            includes: [],
            type: 'node'/'role',
            scripts: {
                before: [],
                after: []
            },
            resources: {
                '/etc/http.conf': {
                    'type': 'file',
                    'path': '/etc/http.conf',
                    'owner': 'nobody',
                    'group': 'nobody',
                    'mode': '0755',
                    'content': '${content of the template}'
                },
                'vhost.conf': {
                    'type': 'vhost',
                    'path': '/etc/httpd/{vhost.name}.conf',
                    'owner': 'nobody',
                    'group': 'nobody',
                    'mode': '0755',
                    'content': '${content of vhost template}'
                },
                
            },
            context:{
                'apache': {
                    'vhosts': {}
                }
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
                message = 'Checking out the configurations for TAG ' + params.tag;
                self.logger_.debug(message + ' ...');
                action.data = {
                    criteria: { '$or': [
                        { type: 'role' },
                        { type: 'node', name: params.node }
                    ]},
                    tag: params.tag 
                };
                action.acquire('configuration.tag.checkout', next);
            },
            function (result, next) { // Reading the node information
                self.logger_.debug(message + ' succeed. Revision: ' + 
                                   result.data.revision);
                // TODO: check if the tag does not exist
                message = 'Reading the node information @revision ' + revision;
                revision = result.data.revision;
                
                //
            }
        ], function (error, result) {
            //
        });
    };

    C.namespace('caligula.handlers.configuration').GenerationHandler = GenerationHandler;

}, '0.0.1', { requires: ['caligula.handlers.base'] });
