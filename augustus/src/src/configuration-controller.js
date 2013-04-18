/*jslint plusplus: true */
/**
* This module provides the basic of the provider of the configuration
* objects, which is designed to operating the actions. For more details,
* please refer to the description of the class ConfigurationController
* below.
*
* @module ConfigurationController
*/

var log4js = require('log4js'),
    async = require('async');

/**
 * Class ConfigurationController is designed to provide the basic
 * functionalities that provide the actions of 'update', 'read',
 * 'delete' and 'history'. 
 *
 * @class ConfigurationController
 * @constructor
*/
function ConfigurationController() {
    'use strict';

    /**
     * The logger object
     *
     * @property logger_
     * @type Logger
     */
    this.logger_ = log4js.getLogger('ConfigurationController');
}

/**
 * Return the result of the non-passed in body. Usually the result is the 
 * string which constructs it. 'null' is supported. Params Validator handler.
 * 
 * @param {object} body body from request body
 * @param {object} data data from parameters
 */
ConfigurationController.prototype.paramValidate_ = function (body, data) {
    'use strict';
    var key, length, result = null;

    if (body && data) {
        for (key in data) {
            if (data.hasOwnProperty(key)) {
                if (body.hasOwnProperty(key) || !data[key].optional) {
                    if (!body.hasOwnProperty(key) ||
                            typeof body[key] !== data[key].type) {
                        result = 'Bad record structure: ' + key +
                                 ' should be a ' + data[key].type;
                        return result;
                    }

                    if (typeof body[key] !== "number") {
                        length = body[key].length;
                    } else {
                        length = body[key];
                    }

                    if (data[key].limit !== null &&
                            length > data[key].limit) {
                        result = 'Post data too large. ' + key +
                                 ' limit: ' + data[key].limit;
                        return result;
                    }
                }
            }
        }
    }
    return null;
};
/**
 * Find global revision by calling Vatican API.
 * 
 * @param {String} name counter's name
 * @param {Function} callback the callback function to be invoked after the 
 *                            counter increasement or when error occurs
 */
ConfigurationController.prototype.getCounter_ = function (name, req, callback) {
    'use strict';
    var self = this,
        prefix = '[global counter: ' + name + '] ',
        err = null;

    if (!name) { // error occurs during parsing the global counter, which is
                 // mainly caused by the malformed JSON string received
        self.logger_.error(prefix + 'Raw data can not be successfully parsed');
    }

    req.call('/vatican/counter', { 'name': name }, function (error, data) {
        if (error) {
            err = new Error(prefix + 'is not founded.');
            self.logger_.error(err.message);
            callback(err.message, null);
            return;
        }

        self.logger_.debug(prefix + 'has been successfully found. Data: ' +
                           data.result.data.value);
        callback(null, data.result.data.value);
    });
};

/**
 * Update a record in configuration's mongodb backend by calling Vatican API.
 * 
 * @param {String} collection current collection
 * @param {String} historyCollection history collection
 * @param {Object} req request body
 * @param {Function} callback the callback function to be invoked after
 *                            update or when error occurs
 */
ConfigurationController.prototype.update = function (collection, historyCollection, req, callback) {
    'use strict';
    var self = this,
        err = null,
        timestamp = Math.round(new Date().getTime() / 1000),
        validator = null,
        params = {
            "revision": {
                "type": "number",
                "limit": null
            }
        };

    async.waterfall([
        function (next) {
            self.getCounter_('revision', req, next);
        },
        function (revision, next) {
            var oldRevision = req.body.revision;
            req.call('/vatican/configuration/' + collection + '/read',
                    { 'criteria': { 'name': req.body.name}},
                    function (error, data) {
                    if (error) {
                        err = new Error('Error occurs within the ' +
                                        collection + ' read.');
                        self.logger_.error(err.message + ' Result: ' +
                                           JSON.stringify(error));
                        next(err.message, null);
                        return;
                    }
                    next(null, data, revision, oldRevision);
                });
        },
        function (oldData, revision, oldRevision, next) {
            if (oldData.result.affected > 0) {
                validator = self.paramValidate_(req.body, params);
                if (validator !== null) {
                    self.logger_.error(validator);
                    next(validator, null);
                    return;
                }

                req.call('/vatican/configuration/' + historyCollection + '/create',
                    oldData.result.data,
                    function (error, data) {
                        if (error) {
                            err = new Error('Error occurs within the ' +
                                            historyCollection + ' create.');
                            self.logger_.error(err.message + ' Result: ' +
                                               JSON.stringify(error));
                            next(err.message, null);
                            return;
                        }

                        self.logger_.debug('History records has been ' +
                                           'successfully created. Result:' +
                                           JSON.stringify(data));
                        next(null, revision, oldRevision);
                    });
            } else {
                req.call('/vatican/configuration/' + collection + '/create',
                    { 'revision' : revision},
                    function (error, data) {
                        if (error) {
                            err = new Error('Error occurs within the ' +
                                            collection + ' create.');
                            self.logger_.error(err.message + ' Result: ' +
                                               JSON.stringify(error));
                            next(err.message, null);
                            return;
                        }
                        next(null, revision, revision);
                    });
            }
        },
        function (revision, needRevision, next) {
            req.body.revision = revision;
            req.body.timestamp = timestamp;
            req.call('/vatican/configuration/' + collection + '/cas',
                    {'compare': { 'revision': needRevision },
                     'set': req.body },
                    function (error, data) {
                    if (error) {
                        err = new Error('Error occurs within the ' +
                                            collection + ' cas.');
                        self.logger_.error(err.message + ' Result: ' +
                                           JSON.stringify(error));
                        next(err.message, null);
                        return;
                    }

                    if (data.result.affected === 0) {
                        err = new Error('Records not found, please check your revision.');
                        self.logger_.error(err.message + ' Result: ' +
                                           JSON.stringify(data));
                        next(err.message, null);
                        return;
                    }
                    self.logger_.debug('Records has been successfully ' +
                                       'updated. Result:' +
                                       JSON.stringify(data));

                    next(null, revision);
                }
                );
        }
    ], function (error, data) {
        if (error) {
            callback(error, null);
            return;
        }
        callback(null, { "result": { "revision" : data}});
    });
};

/**
 * Read a record in configuration's mongodb backend by calling Vatican API.
 * 
 * @param {String} collection current collection
 * @param {Object} req request body
 * @param {Function} callback the callback function to be invoked after
 *                            read or when error occurs
 */
ConfigurationController.prototype.read = function (collection, req, callback) {
    'use strict';
    var self = this,
        err = null;

    req.call('/vatican/configuration/' + collection + '/read',
            req.body,
            function (error, data) {
            if (error) {
                err = new Error('Error occurs within the ' +
                                collection + ' found. Error: ' + JSON.stringify(error));
                self.logger_.error(err.message + ' Data: ' +
                                   JSON.stringify(req.body));
                callback(err.message, null);
                return;
            }
            self.logger_.debug('Records has been successfully read. Result:' +
                               JSON.stringify(data));

            callback(null, data);
        });
};

/**
 * Delete a record in configuration's mongodb backend by calling Vatican API.
 * 
 * @param {String} collection current collection
 * @param {String} historyCollection history collection
 * @param {Object} req request body
 * @param {Function} callback the callback function to be invoked after
 *                            delete or when error occurs
 */
ConfigurationController.prototype.delete = function (collection, historyCollection, req, callback) {
    'use strict';
    var self = this,
        err = null,
        length = null;

    async.waterfall([
        function (next) {
            req.call('/vatican/configuration/' + collection + '/read',
                    { 'criteria': req.body },
                    function (error, data) {
                    if (error) {
                        err = new Error('Error occurs within the ' +
                                        collection + 'read.');
                        self.logger_.error(err.message + ' Data: ' +
                                           JSON.stringify(req.body));
                        next(err.message, null);
                        return;
                    }

                    length = data.result.affected;

                    if (length > 0) {
                        self.logger_.debug('Records has been successfully found.' +
                                           ' Result:' +
                                           JSON.stringify(data.result.data[length - 1]));
                        next(null, data.result.data[length - 1]);

                    } else {
                        err = new Error('Records not found.');
                        self.logger_.error(err.message + ' Data: ' +
                                           JSON.stringify(req.body));
                        next(err.message, null);
                        return;
                    }

                });
        },
        function (oldData, next) {
            req.call('/vatican/configuration/' + historyCollection + '/create',
                    oldData,
                    function (error, data) {
                    if (error) {
                        err = new Error('Error occurs within the ' +
                                        historyCollection + ' create.');
                        self.logger_.error(err.message + ' Data: ' +
                                           JSON.stringify(oldData));
                        next(err.message, null);
                        return;
                    }

                    self.logger_.debug('History records has been ' +
                                       'successfully created. Result:' +
                                       JSON.stringify(data));

                    next(null, oldData);
                });
        },
        function (oldData, next) {
            req.call('/vatican/configuration/' + collection + '/delete',
                    { 'criteria': oldData },
                    function (error, data) {
                    if (error) {
                        err = new Error('Error occurs within the ' +
                                        collection + ' cas.');
                        self.logger_.error(err.message + ' Data: ' +
                                           JSON.stringify(oldData));
                        next(error, null);
                        return;
                    }

                    self.logger_.debug('Records has been successfully ' +
                                       'deleted. Result:' +
                                       JSON.stringify(data));
                    next(null, data);
                });
        }
    ], function (error, data) {
        if (error) {
            callback(error, null);
            return;
        }
        callback(null, {});
    });
};

/**
 * Read a record in configuration's mongodb history backend by calling Vatican API.
 * 
 * @param {String} historyCollection history collection
 * @param {Object} req request body
 * @param {Function} callback the callback function to be invoked after
 *                            read history records or when error occurs
 */
ConfigurationController.prototype.history = function (historyCollection, req, callback) {
    'use strict';
    var self = this,
        err = null;

    req.call('/vatican/configuration/' + historyCollection + '/read',
            req.body,
            function (error, data) {
            if (error) {
                err = new Error('Error occurs within the ' +
                                historyCollection + ' read.');
                self.logger_.error(err.message + ' Data: ' +
                                   JSON.stringify(req.body));
                callback(err.message, null);
                return;
            }
            self.logger_.debug('Records has been successfully read. Result:' +
                               JSON.stringify(data));

            callback(null, data);
        });
};

module.exports = ConfigurationController;
