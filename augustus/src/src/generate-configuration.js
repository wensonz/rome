/*jslint plusplus: true */
/**
* Configuration generate records operating action base provider
*
* @module GenerateConfiguration
*/

var log4js = require('log4js'),
    util = require('util'),
    compares = require('./compare'),
    RoleConfigurationResolver = require('./role-configuration-resolver').RoleConfigurationResolver,
    Formatter = require('./formatters/configuration-json-output-formatter.js').ConfigurationJsonOutputFormatter,
    Writer = require('./writers/configuration-local-file-writer').ConfigurationLocalFileWriter,
    Renderer = require('./renderers/dust-template-renderer.js').DustTemplateRenderer,
    Processor = require('./processors/files-configuration-processor.js').FilesConfigurationProcessor,
    constants = require('./constants'),
    conf = require('./config.json').fileGenerator,
    async = require('async');

/**
 * Desc
 *
 * @class GenerateConfiguration
 * @constructor
*/
function GenerateConfiguration() {
    'use strict';
    /**
     * The logger object
     *
     * @property logger_
     * @type Logger
     */
    this.logger_ = log4js.getLogger('GenerateConfiguration');

    /**
     * Use of the operations find records in mongodb by calling Vatican API;
     *
     * @property self.operations
     * @type object
     */
    this.operations_ = {
        "group": {
            "group_by": "name",
            "max": "revision"
        }
    };

    // Initialize GenerateConfiguration. This is a TEMPORARY scheme!!!
    // TODO: need a function for initialization of Generate Controller.
    this.logger_.debug('Initialize Generate Controller succeed.');
}

/**
 * Read counter records in mongoDB
 * @method readCounter
 * @param {Object} conterCondition use of the condition read counter records
 * @param {Object} req request body
 * @param {Function} callback the callback function to be invoked after
 *                   read counter records or when error occurs
 */
GenerateConfiguration.prototype.readCounter = function(counterCondition, req, callback) {
    'use strict';
    var self = this,
        err = null;

    //read counter record in configuration's mongodb backend by calling Vatican API.
    req.call('/vatican/counter', counterCondition, function (error, counter) {
        if (error) {
            err =  {
                'httpCode': 500,
                'code': constants.error.generate.counter.readError,
                'message': 'Error occurs within the vatican read counter ' +
                           'table. Result: ' + util.inspect(error, false, null)

            };
            self.logger_.error(err.message);
            callback(err);
            return;
        }

        if (counter.result.affected === 0) {
            err =  {
                'httpCode': 415,
                'code': constants.error.generate.counter.dataError,
                'message': 'Read counter record is null in mongodb counter' + 
                           'table by calling Vatican API.'
            };
            self.logger_.error(err.message);
            callback(err);
            return;
        }
        self.logger_.debug('Collection conuter records has been successfully ' + 
                           'found. Result:' + util.inspect(counter, false, null));
                  
        callback(err, counter.result.data.value);
    });
};

/**
 * Read tag records in mongoDB
 * @method readTag
 * @param {Object} tagCondition use of the condition read tag records
 * @param {Object} req request body
 * @param {Function} callback the callback function to be invoked after
 *                   read tag records or when error occurs
 */
GenerateConfiguration.prototype.readTag = function(tagCondition, req, callback) {
    'use strict';
    var self = this,
        err = null;

    //read tag record in configuration's mongodb backend by calling Vatican API.
    req.call('/vatican/configuration/tag/read', {
        'criteria': tagCondition
    }, function (error, tag) {
        if (error) {
            err =  {
                'httpCode': 500,
                'code': constants.error.generate.tag.readError,
                'message': 'Error occurs within the vatican read' +
                           'tag table. Result: ' +
                           util.inspect(error.error.message, false, null)
            };
            self.logger_.error(err.message);
            callback(err);
            return;
        }

        if (tag.result.affected === 0) {
            err =  {
                'httpCode': 415,
                'code': constants.error.generate.tag.dataError,
                'message': 'Read tag record is null in mongodb tag table' + 
                           'by calling Vatican API.'
            };
            self.logger_.error(err.message);
            callback(err);
            return;
        }
        self.logger_.debug('Collection tag records has been successfully found. ' + 
                           'Result:' + util.inspect(tag, false, null));

        callback(err, tag.result.data[0].revision);
    });
};

/**
 * Read idc records in mongoDB
 * @method readIdc
 * @param {Object} req request body
 * @param {Function} callback the callback function to be invoked after
 *                   read idc records or when error occurs
 */
GenerateConfiguration.prototype.readIdc = function(req, callback) {
    'use strict';
    var self = this,
        err = null;

    //read zone record in mongodb backend by calling Vatican API.
    req.call('/vatican/configuration/zone/read', {
        'criteria': {} 
    }, function (error, idcData) {
        if (error) {
            err =  {
                'httpCode': 500,
                'code': constants.error.generate.idc.readError,
                'message': 'Error occurs within the vatican read' +
                           'zone table. Result: ' +
                           util.inspect(error.error.message, false, null)
            };
            self.logger_.error(err.message);
            callback(err);
            return;
        }

        if (idcData.result.affected === 0) {
            err =  {
                'httpCode': 415,
                'code': constants.error.generate.idc.dataError,
                'message': 'Read zone record is null in mongodb zone table' + 
                           'by calling Vatican API.'
            };
            self.logger_.error(err.message);
            callback(err);
            return;
        }
        self.logger_.debug('Collection zone records has been successfully found. ' + 
                           'Result:' + util.inspect(idcData, false, null));

        callback(err, idcData.result.data);
    });
};
/**
 * Read assets records in mongoDB
 * @method readAssets
 * @param {Object} nodes is ip list in post data
 * @param {Object} req request body
 * @param {Function} callback the callback function to be invoked after
 *                   read asssets records or when error occurs
 */
GenerateConfiguration.prototype.readAssets = function(nodes, req, callback) {
    'use strict';
    var self = this,
        err = null,
        nodeList = [],
        assetsCondition = null;

    nodes.forEach(function (node) {
        nodeList.push({'addresses.ip': node});
    });
    assetsCondition = {'$or': nodeList};
    //read assets record in mongodb backend by calling Vatican API.
    req.call('/vatican/assets/read', {
        'criteria': assetsCondition
    }, function (error, assetsData) {
        if (error) {
            err =  {
                'httpCode': 500,
                'code': constants.error.generate.assets.readError,
                'message': 'Error occurs within the vatican read' +
                           'assets table. Result: ' +
                           util.inspect(error.error.message, false, null)
            };
            self.logger_.error(err.message);
            callback(err);
            return;
        }

        if (assetsData.result.affected === 0) {
            err =  {
                'httpCode': 415,
                'code': constants.error.generate.assets.dataError,
                'message': 'Read assets record is null in mongodb assets table' + 
                           'by calling Vatican API.'
            };
            self.logger_.error(err.message);
            callback(err);
            return;
        }
        self.logger_.debug('Collection assets records has been successfully found. ' + 
                           'Result:' + util.inspect(assetsData, false, null));

        callback(err, assetsData.result.data);
    });
};

/**
 * Read node records in mongoDB
 * @method readNode
 * @param {Object} nodes is ip list in post data
 * @param {Number} revision the revision is taken from counter or tag 
 * @param {Object} req request body
 * @param {Function} callback the callback function to be invoked after
 *                   read node records or when error occurs
 */
GenerateConfiguration.prototype.readNode = function(nodes, revision, req, callback) {
    'use strict';
    var self = this,
        err = null,
        nodeList = [],
        categoryNode = [],
        nodesData = null,
        nodeRecord = [],
        condition = null,
        revisionCondition = null;
    
    revisionCondition = { '$lte': revision };
    if (util.isArray(nodes) === true) {
        nodes.forEach(function (node) {
            nodeList.push({'name': node});
        });
        condition = { '$or': nodeList, 'revision': revisionCondition };
    } else {
        nodes.revision = revisionCondition;
        condition = nodes;
    }

    req.call('/vatican/configuration/role/read', {
        'criteria': condition
    }, function (error, node) {
        if (error) {
            err =  {
                'httpCode': 500,
                'code': constants.error.generate.node.readError,
                'message': 'Error occurs within the vatican read' +
                           'node table. Result: ' +
                           util.inspect(error.error.message, false, null)
            };
            self.logger_.error(err.message);
            callback(err);
            return;
        }
        self.logger_.debug('Collection node records has been successfully ' +
                           'found. Result:' + util.inspect(nodes, false, null));

        nodesData = node.result.data;
        req.call('/vatican/configuration/role_history/read', {
            'criteria': condition,
            'operations': self.operations_
        }, function (error, nodesHistory) {
            if (error) {
                err =  {
                    'httpCode': 500,
                    'code': constants.error.generate.node.readHistroyError,
                    'message': 'Error occurs within the vatican read ' + 
                               'node_history table. Result: ' +
                               util.inspect(error.error.message, false, null)
                };
                self.logger_.error(err.message);
                callback(err);
                return;
            }
            self.logger_.debug('Collection node_history records has been ' +
                               'successfully found. Result:' +
                               util.inspect(nodesHistory, false, null));

            //compare node data and node_history data to 
            //generate the final data
            nodesHistory.result.data.forEach(function (x) {
                var nodeTag = 0;
                nodesData.forEach(function (y) {
                    if (x.name === y.name) {
                        nodeTag = 1;
                        return;
                    }
                });
                if (nodeTag === 0) {
                    nodesData.push(x);
                }
            });

            if (nodesData.length === 0) {
                err =  {
                    'httpCode': 415,
                    'code': constants.error.generate.node.dataError,
                    'message': 'Read node record is null in mongodb ' + 
                               'node and node_history table ' + 
                               'by calling Vatican API.'
                };
                self.logger_.error(err.message);
                callback(err);
                return;
            }

            //check postData's nodes whether exist in the nodesData 
            if (util.isArray(nodes) === true) {
                nodes.forEach(function (x) {
                    var testTag = 0;
                    nodesData.forEach(function (y) {
                        if (x === y.name) {
                            testTag = 1;
                            return;
                        }
                    });
                    if (testTag === 0) {
                        nodeRecord.push(x);
                    }
                });
                if (nodeRecord.length !== 0) {
                    err =  {
                        'httpCode': 415,
                        'code': constants.error.generate.node.dataError,
                        'message': 'Read ' + nodeRecord + ' record not found in' +
                                   ' mongodb node and node_history table ' + 
                                   'by calling Vatican API.'
                    };
                    self.logger_.error(err.message);
                    callback(err);
                    return;
                }
            }
            self.logger_.debug('Merage node object records:' +
                               util.inspect(nodesData, false, null));

            nodesData.forEach(function (node) {
                if (node.category) {
                    categoryNode.push(node.name);
                }
            });
            callback(err, nodesData, categoryNode);
        });
    });
};

/**
 * Read role and role_history records in mongoDB
 * @method readRole
 * @param {Object} nodesData read node and node_history in mongodb after merge
 *                 all result and remove duplicate
 * @param {Number} revision the revision is taken from counter or tag 
 * @param {Object} req request body
 * @param {Function} callback the callback function to be invoked after
 *                   read role and role_history records or when error occurs
 */
GenerateConfiguration.prototype.readRole = function(revision, req, callback) {
    'use strict';
    var self = this,
        err = null,
        rolesData = null,
        roleCondition = null,
        revisionCondition = null;
    
    revisionCondition = { '$lte': revision };
    roleCondition = { '$ne': 'node' };
    req.call('/vatican/configuration/role/read', {
        'criteria': { 'category': roleCondition, 
                      'revision': revisionCondition }
    }, function (error, roles) {
        if (error) {
            err =  {
                'httpCode': 500,
                'code': constants.error.generate.role.readError,
                'message': 'Error occurs within the vatican read' +
                           'role table. Result: ' +
                           util.inspect(error.error.message, false, null)
            };
            self.logger_.error(err.message);
            callback(err);
            return;
        }
        self.logger_.debug('Collection role records has been successfully ' +
                           'found. Result:' + util.inspect(roles, false, null));
                  
        rolesData = roles.result.data;
        req.call('/vatican/configuration/role_history/read', {
            'criteria': { 'category': roleCondition, 
                          'revision': revisionCondition },
            'operations': self.operations_
        }, function (error, rolesHistory) {
            if (error) {
                err =  {
                    'httpCode': 500,
                    'code': constants.error.generate.role.readHistoryError,
                    'message': 'Error occurs within the vatican read ' + 
                               'role_history table. Result: ' +
                               util.inspect(error.error.message, false, null)
                };
                self.logger_.error(err.message);
                callback(err);
                return;
            }
            self.logger_.debug('Collection role_history records has been ' + 
                               'successfully found. Result:' +
                               util.inspect(rolesHistory, false, null));

            //compare role data and role_history data to 
            //generate the final data
            rolesHistory.result.data.forEach(function (x) {
                var roleTag = 0;
                rolesData.forEach(function (y) {
                    if (x.name === y.name) {
                        roleTag = 1;
                        return;
                    }
                });
                if (roleTag === 0) {
                    rolesData.push(x);
                }
            });

            if (rolesData.length === 0) {
                err =  {
                    'httpCode': 415,
                    'code': constants.error.generate.role.dataError,
                    'message': 'Read role record is null in mongodb ' +
                               'role and role_history table ' + 
                               'by calling Vatican API.'
                };
                self.logger_.error(err.message);
                callback(err);
                return;
            }
            self.logger_.debug('Merage role object records:' +
                               util.inspect(rolesData, false, null));
            callback(err, rolesData);
        });
    });
};

/**
 * Read template and template_history records in mongoDB
 * @method readTemplate
 * @param {Object} nodesData read node and node_history in mongodb after merge
 *                 all result and remove duplicate
 * @param {Object} rolesData read role and role_history in mongodb after merge
 *                 all result and remove duplicate
 * @param {Number} revision the revision is taken from counter or tag 
 * @param {Object} req request body
 * @param {Function} callback the callback function to be invoked after
 *                   read template and template_history records or when error occurs
 */
GenerateConfiguration.prototype.readTemplate = function(revision, req, callback) {
    'use strict';
    var self = this,
        err = null,
        templateData = null,
        revisionCondition = null;
    
    revisionCondition = { '$lte': revision };
    req.call('/vatican/configuration/template/read', {
        'criteria': { 'revision': revisionCondition }
    }, function (error, template) {
        if (error) {
            err =  {
                'httpCode': 500,
                'code': constants.error.generate.template.readError,
                'message': 'Error occurs within the vatican read ' +
                           'template table. Result:' +
                           util.inspect(error.error.message, false, null)
            };
            self.logger_.error(err.message);
            callback(err);
            return;
        }
        self.logger_.debug('Collection template records has been successfully' +
                           ' found. Result: ' + util.inspect(template, false, null));

        templateData = template.result.data;
        req.call('/vatican/configuration/template_history/read', {
            'criteria': { 'revision': revisionCondition },
            'operations': self.operations_
        }, function (error, templateHistory) {
            if (error) {
                err =  {
                    'httpCode': 500,
                    'code': constants.error.generate.template.readHistoryError,
                    'message': 'Error occurs within the vatican read' +
                               'template_history table. Result: ' +
                               util.inspect(error.error.message, false, null)
                };
                self.logger_.error(err.message);
                callback(err);
                return;
            }
            self.logger_.debug('Collection template_history records has been' +
                               ' successfully found. Result:' +
                               util.inspect(templateHistory, false, null));

            //compare template data and template_history data to 
            //generate the final data
            templateHistory.result.data.forEach(function (x) {
                var templateTag = 0;
                templateData.forEach(function (y) {
                    if (x.name === y.name) {
                        templateTag = 1;
                        return;
                    }
                });

                if (templateTag === 0) {
                    templateData.push(x);
                }
            });

            if (templateData.length === 0) {
                err =  {
                    'httpCode': 415,
                    'code': constants.error.generate.template.dataError,
                    'message': 'Read template record is null in mongodb ' +
                               'template and template_history table ' + 
                               'by calling Vatican API.'
                };
                self.logger_.error(err.message);
                callback(err);
                return;
            }
            self.logger_.debug('Merage template object records:' +
                               util.inspect(templateData, false, null));
            callback(err, templateData);
        });
    });
};

/**
 * Read helpers records in mongoDB
 * @method readHelper
 * @param {Object} req request body
 * @param {Function} callback the callback function to be invoked after
 *                   read helpers records or when error occurs
 */
GenerateConfiguration.prototype.readHelper = function(req, callback) {
    'use strict';
    var self = this,
        err = null;

    //read helpers record in mongodb backend by calling Vatican API.
    req.call('/vatican/configuration/helpers/read', {
        'criteria': {} 
    }, function (error, helpersData) {
        if (error) {
            err =  {
                'httpCode': 500,
                'code': constants.error.generate.helper.readError,
                'message': 'Error occurs within the vatican read' +
                           'assets table. Result: ' +
                           util.inspect(error.error.message, false, null)
            };
            self.logger_.error(err.message);
            callback(err);
            return;
        }

        if (helpersData.result.affected === 0) {
            err =  {
                'httpCode': 415,
                'code': constants.error.generate.helper.dataError,
                'message': 'Read helpers record is null in mongodb helpers table' + 
                           'by calling Vatican API.'
            };
            self.logger_.error(err.message);
            callback(err);
            return;
        }
        self.logger_.debug('Collection helpers records has been successfully found. ' + 
                           'Result:' + util.inspect(helpersData, false, null));

        callback(err, helpersData.result.data);
    });
};

/**
 * render、formatter、writer to the post request file 
 * @method fileGenerator
 * @param {Object} configuration the configuration is generated config files
 * @param {String} node the node is ip address 
 * @param {Number} revision the revision is taken from counter or tag 
 * @param {Object} mergeFile the file content in merge nodes Data and roles 
 *                 Data result
 * @param {Function} processor the function provide render、formatter、writer 
 * @param {Function} callback the callback function to be invoked after
 *                   result of processor function to be invoked or 
 *                   when error occurs
 */
GenerateConfiguration.prototype.fileGenerator = function(configuration,
    node, revision, mergeFile, properties, processor, callback) {
        'use strict';
        var self = this,
            config = [],
            files = {},
            err = null,
            configFiles = [],
            fileOption = {},
            generateConfig = {};

        fileOption.fileUrl = '/' + node + '/';
        fileOption.urlPrefix = conf.urlPrefix;
        fileOption.revision = revision;
        if (configuration.files.length !== 0) {
            configFiles = configuration.files;
            configFiles.forEach(function (file) {
                mergeFile.forEach(function (fileContent) {
                    if (file === fileContent.name){
                        files[file] = fileContent;
                    }
                });
            });
        } else {
            mergeFile.forEach(function (fileContent) {
                configFiles.push(fileContent.name);
                files[fileContent.name] = fileContent;
            });
        }
        self.logger_.debug('Should be configuration files exist in the merge' +
                           ' data: ' + util.inspect(files, false, null));

        if (Object.keys(files).length !== 0) {
            Object.keys(files).forEach(function (f) {
                config.push(files[f]);
            });
            async.forEachSeries(config, function (file, next) {                                                  
                if (file.name) {                                                           
                    processor.compareConfigurationContent(file, function (error) {             
                        if (error) {                                                            
                            next(error);                                                     
                            return;                                                              
                        }                                                                       
                        processor.process(fileOption, file, properties,
                            function (error, config, httpUrl) {
                                if (error) {
                                    next(error);
                                }
                                generateConfig[config] = httpUrl;
                                next();
                        });
                    });                                                                         
                } else {
                    callback(null, file.name);
                }
                
            }, function (error) {
                callback(error, generateConfig);
            });
        } else {
            callback(null, {});
        }
};

/**
 * use of the node and idc merge in properties and handle configuration files
 * @method mergeData
 * @param {string} nodeName the nodeName one of the ip in post data
 * @param {Object} idcData read idc records in mongodb
 * @param {Object} rolesData read role records in mongodb
 * @param {Object} assetsData read node assets records in mongodb
 * @param {Object} mergeResult merge node and rolesData result
 * @param {Function} callback the callback function to be invoked after
 *                   callback mergeFile and properties records or 
 *                   when error occurs
 */
GenerateConfiguration.prototype.mergeData = function(nodeName, idcData,
    rolesData, assetsData, mergeResult, callback) {
        'use strict';
        var self = this,
            mergeFile = null,
            properties = {},
            idcName = [],
            err = null;
        
        //check merge result and saved configuration files to a new object
        mergeResult.includes.forEach(function (role) {
            if (rolesData[role].category === "zone") {
                idcName.push(role);
            }
        });
        mergeFile = mergeResult.configuration.files;

        self.logger_.debug('Should be configuration files in mergeResult.' + 
                           ' Result: ' + util.inspect(mergeFile, false, null));

        //find node assets records and saved to a new object
        if (assetsData.length !== 0) {
            assetsData.forEach(function (assets) {
                assets.addresses.forEach(function (address) {
                    if (address.ip === nodeName) { 
                        properties.node = assets; 
                    }
                });
            });
        }
        
        //compare idc number and saved idcData to a new object
        if (idcName.length === 1) {
            idcData.forEach(function (data) {
                if (data.name === idcName[0]) {
                    properties.zone = data;    
                    return;
                }
            });
        } else if (idcName.length > 1) {
            err = {
                'httpCode': 415,
                'code': constants.error.generate.idc.dataError,
                'message': 'Should be include idc can not more then 1.'
            };
            self.logger_.error(err.message); 
            callback(err);
        } else {
            err = {
                'httpCode': 415,
                'code': constants.error.generate.idc.dataError,
                'message': 'Should be include idc not exist.'
            };
            self.logger_.error(err.message); 
            callback(err);
            return;
        }

        self.logger_.debug('Should be merge properties. Result: ' +
                           util.inspect(properties, false, null));

        callback(err, mergeFile, properties);
};

/**
 * Use of the request data read records in configuration's mongodb history backend by calling Vatican API.
 * @generater
 * @param {Object} req request body
 * @param {Object} res response
 */
GenerateConfiguration.prototype.generator = function (req, res) {
    'use strict';
    var self = this,
        validator = null,
        compare = null,
        tagName = null,
        nodes = null,
        configuration = null,
        tagCondition = null,
        counterCondition = null,
        params = null;

    params = {
        'nodes': {
            'type': 'object',
            'limit': null
        },
        'tag': {
            'optional': true,
            'type': 'string',
            'limit': null
        },
        'configuration': {
            'type': 'object',
            'limit': null
        }
    };

    compare = new compares.Compare();
    validator = compare.paramValidate_(req.body, params);
    if (validator !== null) {
        self.logger_.error(validator);
        res.json(415, {
            'error' : {
                'code': constants.error.generate.postDataError,
                'message': validator
            }
        });
        return;
    }
    
    tagName = req.body.tag;
    nodes = req.body.nodes;
    configuration = req.body.configuration;


    async.waterfall([
        function (next) {
            if (!tagName) {
                counterCondition = { 'name': 'revision', 'step': 0 };
                self.readCounter(counterCondition, req, function (err, revision) {
                    next(err, revision);
                });
            } else {
                tagCondition = { 'name': tagName };
                self.readTag(tagCondition, req, function (err, revision) {
                    next(err, revision);
                });
            }
        },
        //read idc records in mongodb by calling Vatican API
        function (revision, next) {
            self.readIdc(req, function (err, idcData) {
                next(err, idcData, revision);
            });
        },
        //read less than or equal to revision number records in mongodb's 
        //node by calling Vatican API
        function (idcData, revision, next) {
            self.readNode(nodes, revision, req, function (err, nodesData, categoryNode) {
                next(err, idcData, nodesData, categoryNode, revision);
            });
        },
        //read assets records in mongodb by calling Vatican API
        function (idcData, nodesData, categoryNode, revision, next) {
            if (categoryNode) {
                self.readAssets(categoryNode, req, function (err, assetsData) {
                    next(err, idcData, assetsData, nodesData, revision);
                });
            } else {
                var assetsData = [],
                    err = null;
                next(err, idcData, assetsData, nodesData, revision);
            }
        },
        //read less than or equal to revision number records in mongodb's 
        //role by calling Vatican API
        function (idcData, assetsData, nodesData, revision, next) {
            self.readRole(revision, req, function (err, rolesData) {
                    next(err, idcData, assetsData, nodesData, rolesData,
                         revision);
            });
        },
        //read less than or equal to revision number records in mongodb's 
        //template table by calling Vatican API
        function (idcData, assetsData, nodesData, rolesData, revision, next) {
            self.readTemplate(revision, req, function (err, templateData) {
                next(err, idcData, assetsData, nodesData, rolesData, 
                     templateData, revision);
            });
        },
        //read helper records in mongodb's helpers table by calling Vatican API
        function (idcData, assetsData, nodesData, rolesData, templateData,
            revision, next) {
            self.readHelper(req, function (err, helpersData) {
                next(err, idcData, assetsData, nodesData, rolesData, 
                     templateData, helpersData, revision);
            });
        },
    //nodesData、rolesData、templateData is Object
    ], function (error, idcData, assetsData, nodesData, rolesData,
        templateData, helpersData, revision) {
            var newRD = {},
                result = {},
                resolver = null,
                renderer = null,
                formatter = null,
                writer = null,
                processor = null,
                roleName = null;

            if (error) {
                res.json(error.httpCode, {
                    'error' : {
                        'code': error.code,
                        'message': error.message
                    }
                });
                return;
            }
            //format roles data(example: {value: {'name': value,...},...})
            rolesData.forEach(function (role) {
                roleName = role.name;
                newRD[roleName] = role;
            });

            rolesData = newRD;
            renderer = new Renderer(templateData, helpersData);
            resolver = new RoleConfigurationResolver();
            formatter = new Formatter();
            writer = new Writer(conf.fsPrefix);
            processor = new Processor(renderer, formatter, writer);

            //rotational training each ip
            async.forEachSeries(nodesData, function (node, next) {
                var mergeResult = null,
                    err = null,
                    nodesContent = {},
                    nodeName = node.name;
                
                //data merage;
                try {
                    mergeResult = resolver.resolve(node, rolesData);
                } catch (error) {
                    err = {
                        'httpCode': 415,
                        'code': constants.error.merge.mergeError,
                        'message': 'Should be merage error. Result: ' +
                                    util.inspect(error, false, null)
                    };
                    self.logger_.error(err.message); 
                    next(err);
                    return;
                }
                self.logger_.debug('Merage all information has been successfully.' +
                                   ' Result: ' + util.inspect(mergeResult, false, null));

                self.mergeData(nodeName, idcData, rolesData, assetsData,
                    mergeResult, function (err, mergeFile, properties) {
                        if (err) {
                            next(err);
                            return;
                        }
                        if (configuration.files) {
                            if (util.isArray(configuration.files) !== true) {
                                res.json(415, {
                                    'error' : {
                                        'code': constants.error.generate.postDataError,
                                        'message': 'files must be exist and type' +
                                                   ' should be a array in ' + 
                                                   'configuration object.'
                                    }
                                });
                                return;
                            }
                            self.fileGenerator(configuration, nodeName, revision,
                                mergeFile, properties, processor, function (error, config) {
                                    if (error) {
                                        next(error);
                                        return;
                                    }
                                    nodesContent.files = config;
                                    result[nodeName] = nodesContent;
                                    next();
                            });    
                        } else {
                            result[nodeName] = {};
                            next();
                        }
                });
            }, function (error) {
                if (error) {
                    res.json(error.httpCode, {
                        'error' : {
                            'code': error.code,
                            'message': error.message
                        }
                    });
                    return;
                }
                res.json(200, {
                    'result' : result
                });
                self.logger_.info('Generate has been successfully!');
            });
    });
};

module.exports = GenerateConfiguration;
