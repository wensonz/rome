/*jslint plusplus: true */
/**
* Configuration role records operating action provider
*
* @module RoleController
*/

var ConfigurationController = require('./configuration-controller'),
    log4js = require('log4js'),
    util = require('util'),
    constants = require('./constants');

/**
 * Class RoleController inherit from ConfigurationController to provide the
 * functionalities that resolve the records about roles. The functionalities
 * of RoleController consists of the following states:
 *
 *     "update" - update exist role or create a new role
 *     "read" - read some roles in addition to the history of role records
 *     "delete" - delete a role
 *     "history" - list history roles
 *
 * In order to resolve the records among request objects, Vatican is
 * involved. All the processing need through calling the Vatican api.
 *
 * @class RoleController
 * @constructor
*/
function RoleController() {
    'use strict';

    /* inherit from ConfigurationController */
    ConfigurationController.call(this);

    /**
     * The logger object
     *
     * @property logger_
     * @type Logger
     */
    this.logger_ = log4js.getLogger('RoleController');

    // Initialize RoleControler. This is a TEMPORARY scheme!!!
    // TODO: need a function for initialization of Role Controller.
    this.logger_.debug('Role Controller Initialized.');

}

util.inherits(RoleController, ConfigurationController);

/**
 * Update a record in configuration's mongodb backend by calling Vatican API.
 * 
 * @param {Object} req request body
 * @param {Object} res response
 */
RoleController.prototype.update = function (req, res) {
    'use strict';
    var self = this,
        params = null,
        validator = null;

    //CHECK PARAMETERS
    params = {
        "name": {
            "type": "string",
            "limit": constants.limit.role.nameLength
        },
        "includes": {
            "optional": true,
            "type": "object",
            "limit": constants.limit.role.includeListLength
        },
        "configuration": {
            "type": "object",
            "limit": null
        },
        "changelog": {
            "type": "string",
            "limit": constants.limit.role.changelogLength
        }
    };

    /*
    file_params = {
        "name": {
            "type": "string",
            "limit": constants.limit.role.filenameLength
        },
        "path": {
            "type": "string",
            "limit": constants.limit.role.filepathLength
        },
        "owner": {
            "type": "string",
            "limit": constants.limit.role.fileownerLength
        },
        "permission": {
            "type": "string",
            "limit": constants.limit.role.filepermissionLength
        },
        "template": {
            "type": "string",
            "limit": constants.limit.role.filetemplateLength
        },
        "data": {
            "type": "object",
            "limit": constants.limit.role.dataLength
        }
    };
    */

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

    /*
    if (req.body.configuration.files) {
        for (i = 0; i < req.body.configuration.files.length; i++) {
            validators[i] = ConfigurationController.prototype.paramValidate_.call(this,
                req.body.configuration.files[i], file_params);
            if (validators[i] !== null) {
                self.logger_.error(validators[i]);
                res.json(415, {
                    "error" : {
                        "code": constants.error.paramError,
                        "message": validators[i]
                    }
                });
                return;
            }
        }
    }
    */

    ConfigurationController.prototype.update.call(this, 'role', 'role_history',
        req, function (error, data) {
            if (error) {
                res.json(500, {
                    "error" : {
                        "code": constants.error.role.updateError,
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
RoleController.prototype.read = function (req, res) {
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

    ConfigurationController.prototype.read.call(this, 'role', req,
        function (error, data) {
            if (error) {
                res.json(500, {
                    "error" : {
                        "code": constants.error.role.readError,
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
RoleController.prototype.delete = function (req, res) {
    'use strict';
    var self = this,
        params = null,
        validator = null;

    params = {
        "name": {
            "type": "string",
            "limit": constants.limit.role.nameLength
        },
        "revision": {
            "optional": true,
            "type": "number",
            "limit": null
        },
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

    ConfigurationController.prototype.delete.call(this, 'role', 'role_history',
        req, function (error, data) {
            if (error) {
                res.json(500, {
                    "error" : {
                        "code": constants.error.role.deleteError,
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
RoleController.prototype.history = function (req, res) {
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
            "limit": constants.limit.role.operationLimitSize
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
        req.body.operations.limit = constants.limit.role.operationLimitDefaultSize;
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

    ConfigurationController.prototype.history.call(this, 'role_history',
        req, function (error, data) {
            if (error) {
                res.json(500, {
                    "error" : {
                        "code": constants.error.role.historyError,
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

module.exports = RoleController;
