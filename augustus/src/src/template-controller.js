/*jslint plusplus: true */
/**
* Configuration template records operating action provider
*
* @module TemplateController
*/

var ConfigurationController = require('./configuration-controller'),
    log4js = require('log4js'),
    util = require('util'),
    dust = require('dust'),
    constants = require('./constants');

/**
 * Class TemplateController inherit from ConfigurationController to provide the
 * functionalities that resolve the records about templates.The functionalities
 * of TemplateController consists of the following states:
 *
 *     "update" - update exist template or create a new template
 *     "read" - read some templates in addition to the history of templates
 *     "delete" - delete a template
 *     "history" - list history templates
 *
 * In order to resolve the records among request objects, Vatican is
 * involved. All the processing need through calling the Vatican api.
 *
 * @class TemplateController
 * @constructor
*/
function TemplateController() {
    'use strict';

    /* inherit from ConfigurationController */
    ConfigurationController.call(this);

    /**
     * The logger object
     *
     * @property logger_
     * @type Logger
     */
    this.logger_ = log4js.getLogger('TemplateController');

    // Initialize TemplateConttemplater. This is a TEMPORARY scheme!!!
    // TODO: need a function for initialization of Template Controller.
    this.logger_.debug('Template Controller Initialized.');

}

util.inherits(TemplateController, ConfigurationController);

/**
 * Update a record in configuration's mongodb backend by calling Vatican API.
 * 
 * @param {Object} req request body
 * @param {Object} res response
 */
TemplateController.prototype.update = function (req, res) {
    'use strict';
    var self = this,
        params = null,
        validator = null;

    //CHECK PARAMETERS
    params = {
        "name": {
            "type": "string",
            "limit": constants.limit.template.nameLength
        },
        "changelog": {
            "type": "string",
            "limit": constants.limit.template.changelogLength
        },
        "content": {
            "type": "string",
            "limit": constants.limit.template.contentLength
        }
    };

    validator = ConfigurationController.prototype.paramValidate_.call(this,
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

    try {
        req.body.compile = dust.compile(req.body.content, req.body.name);
    } catch (error) {
        self.logger_.error(error);
        res.json(500, {
            "error" : {
                "code": constants.error.template.updateError,
                "message": error
            }
        });
        return;
    }

    ConfigurationController.prototype.update.call(this, 'template', 'template_history',
        req, function (error, data) {
            if (error) {
                res.json(500, {
                    "error" : {
                        "code": constants.error.template.updateError,
                        "message": error
                    }
                });
                return;
            }
            self.logger_.info("Update record : [" + JSON.stringify(req.body) +
                              "] succeed. Result: " + JSON.stringify(data));
            res.json(200, data);
        });
};

/**
 * Read a record in configuration's mongodb backend by calling Vatican API.
 * 
 * @param {Object} req request body
 * @param {Object} res response
 */
TemplateController.prototype.read = function (req, res) {
    'use strict';
    var self = this,
        params = null,
        validator = null;

    // check params
    params = {
        "criteria": {
            "type": "object",
            "limit": null
        },
        "fileds": {
            "optional": true,
            "type": "object",
            "limit": null
        },
        "operations": {
            "optional": true,
            "type": "object",
            "limit": null
        }
    };

    validator = ConfigurationController.prototype.paramValidate_.call(this,
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

    ConfigurationController.prototype.read.call(this, 'template', req,
        function (error, data) {
            if (error) {
                res.json(500, {
                    "error" : {
                        "code": constants.error.template.readError,
                        "message": error
                    }
                });
                return;
            }
            self.logger_.info("Read record : [" + JSON.stringify(req.body) +
                              "] succeed. Result: " + JSON.stringify(data));
            res.json(200, data);
        });
};

/**
 * Delete a record in configuration's mongodb backend by calling Vatican API.
 * 
 * @param {Object} req request body
 * @param {Object} res response
 */
TemplateController.prototype.delete = function (req, res) {
    'use strict';
    var self = this,
        params = null,
        validator = null;

    params = {
        "name": {
            "type": "string",
            "limit": constants.limit.template.nameLength
        },
        "revision": {
            "optional": true,
            "type": "number",
            "limit": null
        }
    };

    validator = ConfigurationController.prototype.paramValidate_.call(this,
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

    ConfigurationController.prototype.delete.call(this, 'template', 'template_history',
        req, function (error, data) {
            if (error) {
                res.json(500, {
                    "error" : {
                        "code": constants.error.template.deleteError,
                        "message": error
                    }
                });
                return;
            }
            self.logger_.info("Delete record : [" + JSON.stringify(req.body) +
                              "] succeed. Result: " + JSON.stringify(data));
            res.json(200, data);
        });
};

/**
 * Read a record in configuration's mongodb history backend by calling Vatican API.
 * 
 * @param {Object} req request body
 * @param {Object} res response
 */
TemplateController.prototype.history = function (req, res) {
    'use strict';
    var self = this,
        params = null,
        operations_params = null,
        validator = null,
        operations_validator = null;

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
            "limit": constants.limit.template.operationLimitSize
        }
    };

    validator = ConfigurationController.prototype.paramValidate_.call(this,
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
        req.body.operations.limit = constants.limit.template.operationLimitDefaultSize;
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

    ConfigurationController.prototype.history.call(this, 'template_history',
        req, function (error, data) {
            if (error) {
                res.json(500, {
                    "error" : {
                        "code": constants.error.template.historyError,
                        "message": error
                    }
                });
                return;
            }
            self.logger_.info("History record : [" + JSON.stringify(req.body) +
                              "] succeed. Result: " + JSON.stringify(data));
            res.json(200, data);
        });
};

module.exports = TemplateController;
