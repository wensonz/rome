/*jslint plusplus: true */
/**
* Configuration tag records operating action provider
*
* @module TagController
*/

var ConfigurationController = require('./configuration-controller'),
    log4js = require('log4js'),
    async = require('async'),
    util = require('util'),
    constants = require('./constants');

/**
 * Class TagController provide the functionalities that resolve the records
 * about tag. The functionalities of TagController consists of the following
 * states:
 *
 *     "create" - create a new tag record
 *     "read" - list history tag records
 *
 * In order to resolve the records among request objects, Vatican is
 * involved. All the processing need through calling the Vatican api.
 *
 * @class TagController
 * @constructor
*/
function TagController() {
    'use strict';

    /* inherit from ConfigurationController */
    ConfigurationController.call(this);

    /**
     * The logger object
     *
     * @property logger_
     * @type Logger
     */
    this.logger_ = log4js.getLogger('TagController');

    // Initialize NodeControler. This is a TEMPORARY scheme!!!
    // TODO: need a function for initialization of Role Controller.
    this.logger_.debug('Tag Controller Initialized.');

}

util.inherits(TagController, ConfigurationController);

/**
 * Create a tag record in configuration's mongodb backend by calling Vatican API.
 * 
 * @param {Object} req request body
 * @param {Object} res response
 */
TagController.prototype.create = function (req, res) {
    'use strict';
    var self = this,
        validator = null,
        params = null,
        err = null,
        timestamp = Math.round(new Date().getTime() / 1000);
console.log(req.body);
    params = {
        "name": {
            "type": "string",
            "limit": constants.limit.tag.nameLength
        },
        "revision": {
            "optional": true,
            "type": "number",
            "limit": null
        },
        "changelog": {
            "type": "string",
            "limit": constants.limit.tag.changelogLength
        }
    };

    validator = ConfigurationController.prototype.paramValidate_.call(self,
        req.body, params);
    if (validator !== null) {
        self.logger_.error(validator);
        res.json(415, {
            "error" : {
                "code": constants.error.paramError,
                "message": validator
            }
        });
        return;
    }

    async.waterfall([
        function (next) {
            req.call('/vatican/configuration/tag/read',
                { 'criteria' : {'name': req.body.name }},
                function (error, data) {
                    if (error) {
                        err = new Error('Error occurs within the create tag.');
                        self.logger_.error(err.message);
                        next(err.message, null);
                        return;
                    }

                    if (data.result.affected > 0) {
                        self.logger_.debug('Tag records has been successfully ' +
                                           'found. Data:' + JSON.stringify(data.result.data));

                        err = new Error('Tag name [' + req.body.name +
                                        '] already exists.');
                        next(err.message, null);
                        return;
                    }

                    self.logger_.debug('Tag name is usable. Data:' +
                                        JSON.stringify(req.body));
                    next(null, data);
                });
        },
        function (unused, next) {
            if (!req.body.revision) {
                ConfigurationController.prototype.getCounter_.call(self,
                    'revision', req, next);
            } else {
                next(null, req.body.revision);
            }
        },
        function (revision, next) {
            req.body.revision = revision;
            req.body.timestamp = timestamp;
            req.call('/vatican/configuration/tag/create', req.body, next);
        }
    ], function (error, data) {
        if (error) {
            self.logger_.error(error);
            res.json(500, {
                "error" : {
                    "code": constants.error.tag.createError,
                    "message": error
                }
            });
            return;
        }
        self.logger_.info("Create record : [" + JSON.stringify(req.body) +
                          "] succeed. Result: " +
                          JSON.stringify(req.body.revision));
        res.json(200, { "result": { "revision": req.body.revision }});
    });
};

/**
 * Read tag history record in configuration's mongodb
 * backend by calling Vatican API.
 * 
 * @param {Object} req request body
 * @param {Object} res response
 */
TagController.prototype.history = function (req, res) {
    'use strict';
};

/**
 * Delete a record in configuration's mongodb backend
 * by calling Vatican API.
 * 
 * @param {Object} req request body
 * @param {Object} res response
 */
TagController.prototype.delete = function (req, res) {
    'use strict';
};

/**
 * Read some tag record with criteria in configuration's mongodb
 * history backend by calling Vatican API.
 * 
 * @param {Object} req request body
 * @param {Object} res response
 */
TagController.prototype.read = function (req, res) {
    'use strict';
    var self = this,
        params = null,
        operations_params = null,
        validator = null,
        operations_validator = null,
        err = null;

    params = {
        "criteria": {
            "type": "object",
            "limit": null
        },
        "operations": {
            "optional": true,
            "type": "object",
            "limit": null
        }
    };

    operations_params = {
        "limit": {
            "optional": true,
            "type": "number",
            "limit": constants.limit.tag.operationLimitSize
        }
    };

    validator = ConfigurationController.prototype.paramValidate_.call(self,
        req.body, params);
    if (validator !== null) {
        self.logger_.error(validator);
        res.json(415, {
            "error" : {
                "code": constants.error.paramError,
                "message": validator
            }
        });
        return;
    }

    if (req.body.operations && !req.body.operations.limit) {
        req.body.operations.limit = constants.limit.tag.operationLimitDefaultSize;
    } else {
        operations_validator = ConfigurationController.prototype.paramValidate_.call(this,
            req.body.operations, operations_params);
        if (operations_validator !== null) {
            self.logger_.error(operations_validator);
            res.json(415, {
                "error" : {
                    "code": constants.error.paramError,
                    "message": operations_validator
                }
            });
            return;
        }
    }

    req.call('/vatican/configuration/tag/read', req.body,
        function (error, data) {
            if (error) {
                err = new Error('Error occurs within the tag read.');
                self.logger_.error(err.message + ' Data: ' +
                                   JSON.stringify(req.body));
                res.json(500, {
                    "error" : {
                        "code": constants.error.tag.readError,
                        "message": err.message
                    }
                });
                return;
            }

            self.logger_.info("Read record : [" + JSON.stringify(req.body) +
                              "] succeed. Result: " + JSON.stringify(data));
            res.json(200, data);
        });
};

module.exports = TagController;
