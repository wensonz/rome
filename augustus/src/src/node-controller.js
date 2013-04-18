/*jslint plusplus: true */
/**
* Configuration node records operating action provider
*
* @module NodeController
*/

var ConfigurationController = require('./configuration-controller'),
    log4js = require('log4js'),
    util = require('util'),
    constants = require('./constants');

/**
 * Class NodeController inherit from ConfigurationController to provide the
 * functionalities that resolve the records about nodes. The functionalities
 * of NodeController consists of the following states:
 *
 *     "update" - update exist node or create a new node
 *     "read" - read some nodes in addition to the history of node records
 *     "delete" - delete a node
 *     "history" - list history nodes
 *
 * In order to resolve the records among request objects, Vatican is
 * involved. All the processing need through calling the Vatican api.
 *
 * @class NodeController
 * @constructor
*/
function NodeController() {
    'use strict';

    /* inherit from ConfigurationController */
    ConfigurationController.call(this);

    /**
     * The logger object
     *
     * @property logger_
     * @type Logger
     */
    this.logger_ = log4js.getLogger('NodeController');

    // Initialize NodeContnoder. This is a TEMPORARY scheme!!!
    // TODO: need a function for initialization of Node Controller.
    this.logger_.debug('Node Controller Initialized.');

}

util.inherits(NodeController, ConfigurationController);

/**
 * Update a record in configuration's mongodb backend by calling Vatican API.
 * 
 * @param {Object} req request body
 * @param {Object} res response
 */
NodeController.prototype.update = function (req, res) {
    'use strict';
    var self = this,
        params = null,
        validator = null;

    //CHECK PARAMETERS
    params = {
        "name": {
            "type": "string",
            "limit": constants.limit.node.nameLength
        },
        "changelog": {
            "type": "string",
            "limit": constants.limit.node.changelogLength
        },
        "roles": {
            "type": "object",
            "limit": constants.limit.node.nodesListLength
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

    ConfigurationController.prototype.update.call(this, 'node', 'node_history',
        req, function (error, data) {
            if (error) {
                res.json(500, {
                    "error" : {
                        "code": constants.error.node.updateError,
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
NodeController.prototype.read = function (req, res) {
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

    ConfigurationController.prototype.read.call(this, 'node', req,
        function (error, data) {
            if (error) {
                res.json(500, {
                    "error" : {
                        "code": constants.error.node.readError,
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
NodeController.prototype.delete = function (req, res) {
    'use strict';
    var self = this,
        params = null,
        validator = null;

    params = {
        "name": {
            "type": "string",
            "limit": constants.limit.node.nameLength
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

    ConfigurationController.prototype.delete.call(this, 'node', 'node_history',
        req, function (error, data) {
            if (error) {
                res.json(500, {
                    "error" : {
                        "code": constants.error.node.deleteError,
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
NodeController.prototype.history = function (req, res) {
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
            "limit": constants.limit.node.operationLimitSize
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
        req.body.operations.limit = constants.limit.node.operationLimitDefaultSize;
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

    ConfigurationController.prototype.history.call(this, 'node_history',
        req, function (error, data) {
            if (error) {
                res.json(500, {
                    "error" : {
                        "code": constants.error.node.historyError,
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

module.exports = NodeController;
