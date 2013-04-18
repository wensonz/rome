/**
* This module implements the data storage controller which provides
* the CRUD operations for data manipulation via HTTP-base RESTful APIs
*
* @module data-storage
*/



var assert = require('assert'),
    log4js = require('log4js'),
    mongodb = require('mongodb-ext'),
    Q = require('q'),
    fs = require('fs');


var VaticanControllerConfig = JSON.parse(fs.readFileSync(__dirname + '/config.json'));

assert.strictEqual(typeof VaticanControllerConfig.mongodb, 'object');
assert.strictEqual(typeof VaticanControllerConfig.mongodb.host, 'string');
assert.strictEqual(typeof VaticanControllerConfig.mongodb.port, 'number');

/* Set mongodb default pool size. */
if (VaticanControllerConfig.mongodb.server_options) {
    if (typeof VaticanControllerConfig.mongodb.server_options.poolSize !== 'number') {
        VaticanControllerConfig.mongodb.server_options.poolSize = 10;
    }
}


/**
 * Data storage controller handles the CRUD requests via HTTP-based RESTful
 * APIs, and persistent the data into managed Mongodb cluster whose params are
 * provided via the config object passed-in during the construction.
 *
 * @class VaticanControllerController
 * @constructor
 *
 */
function VaticanController() {
    "use strict";
    this.logger_ = log4js.getLogger('VaticanController');
}


/**
 * Insert one record into db.
 * create 不提供数据唯一性检查，相同的数据可以重复插入，
 * 如果需要插入的数据唯一，请在数据库中对相应字段做唯一索引。
 *
 * @method create
 * @param {Object} req http request object.
 * @param {Object} res http response object.
 */
VaticanController.prototype.create = function (req, res) {
    "use strict";
    var self = this;
    mongodb.openMongodbCollection(VaticanControllerConfig, req.params.resource)
        .then(function (collection) {
            var defer = Q.defer();
            collection.insert(req.body, {safe: true},
                function (err, records) {
                    collection.close();
                    if (err) {
                        defer.reject(new Error(err));
                        return;
                    }
                    self.logger_.info("create: " + records.length + " records");
                    res.json(200, {
                        "result": { "affected": records.length }
                    });
                });
            return defer.promise;
        })
        .fail(function (err) {
            self.logger_.error(err.message);
            res.json(500, { "error" : { "code": 1002, "message": err.message } });
        });
};

/**
 * Get all records matched criteria from db
 *
 * @method read
 * @param {Object} req http request object.
 * @param {Object} res http response object.
 */
VaticanController.prototype.read = function (req, res) {
    "use strict";
    var self = this,
        criteria = req.body.criteria,
        fields = req.body.fields,
        operations = req.body.operations,
        cursor = null,
        err = null;

    if (typeof operations !== "object") {
        operations = {};
    }
    if (operations.count) {
        self.count(req, res);
        return;
    }
    if (operations.hasOwnProperty('group')) {
        self.group(req, res);
        return;
    }
    if (typeof criteria !== "object") {
        err = new Error("criteria should be an object");
        self.logger_.error(err.message);
        res.json(415, { "error" : { "code": 1001, "message": err.message } });
        return;
    }
    // _id of mongodb don't display default.
    if (typeof fields !== "object") {
        fields = {"_id": 0};
    } else if (!fields._id) {
        fields._id = 0;
    }

    mongodb.openMongodbCollection(VaticanControllerConfig, req.params.resource)
        .then(function (collection) {
            var defer = Q.defer();
            var cursor = collection.find(criteria, fields, operations);
            cursor.toArray(function (err, records) {
                collection.close();
                var affected = null;
                if (err) {
                    defer.reject(new Error(err));
                }
                if (operations.limit || operations.skip) {
                    cursor.count(function (err, count) {
                        if (err) {
                            defer.reject(new Error(err));
                        } else {
                            defer.resolve([count, records]);
                        }
                    });
                } else {
                    defer.resolve([records.length, records]);
                }
            });
            return defer.promise;
        })
        .spread(function (count, records) {
                self.logger_.info("read " + count + " records");
                res.json(200, {
                    "result": {
                        "affected": count,
                        "data": records
                    }
                });
        })
        .fail(function (err) {
            self.logger_.error(err.message);
            res.json(500, { "error" : { "code": 1002, "message": err.message ? err.message : err} });
        });
};

/**
 * Update all records matched criteria from db
 *
 * @method update
 * @param {Object} req http request object.
 * @param {Object} res http response object.
 */
VaticanController.prototype.update = function (req, res) {
    "use strict";
    var self = this,
        criteria = req.body.criteria,
        update = req.body.update,
        err = null;

    if (typeof criteria !== "object") {
        err = new Error("criteria should be an object");
    } else if (typeof update !== "object") {
        err = new Error("update should be an object");
    }
    if (err) {
        self.logger_.error(err.message);
        res.json(415, { "error" : { "code": 1001, "message": err.message }});
        return;
    }

    mongodb.openMongodbCollection(VaticanControllerConfig, req.params.resource)
        .then(function (collection) {
            var defer = Q.defer();
            collection.update(criteria, update, {safe: true},
                function (err, counts) {
                    collection.close();
                    if (err) {
                        defer.reject(new Error(err));
                        return;
                    }
                    self.logger_.info("update: " + counts + " records");
                    res.json(200, {
                        "result": {
                            "affected": counts
                        }
                    });
                });
            return defer.promise;
        })
        .fail(function (err) {
            self.logger_.error(err.message);
            res.json(500, { "error" : { "code": 1002, "message": err.message } });
        });
};

/**
 * Delete all records matched criteria from db
 *
 * @method delete
 * @param {Object} req http request object.
 * @param {Object} res http response object.
 */
VaticanController.prototype.delete = function (req, res) {
    "use strict";
    var self = this,
        criteria = req.body.criteria,
        err = null;

    if (typeof criteria !== "object" ||
            Object.keys(req.body.criteria).length === 0) {
        err = new Error("criteria should be an object");
        self.logger_.error(err.message);
        res.json(415, { "error" : { "code": 1001, "message": err.message } });
        return;
    }

    mongodb.openMongodbCollection(VaticanControllerConfig, req.params.resource)
        .then(function (collection) {
            var defer = Q.defer();
            collection.remove(criteria, {safe: true}, function (err, counts) {
                collection.close();
                if (err) {
                    defer.reject(new Error(err));
                    return;
                }
                self.logger_.info("remove: " + counts + " records");
                res.json(200, {
                    "result": {
                        "affected": counts
                    }
                });
            });
            return defer.promise;
        })
        .fail(function (err) {
            self.logger_.error(err.message);
            res.json(500, { "error" : { "code": 1002, "message": err.message } });
        });
};

/**
 * Find and modify.
 * @method cas
 * @param {Object} req  http request object.
 * @param {Object} res  http response object.
 */
VaticanController.prototype.cas = function (req, res) {
    "use strict";
    var self = this,
        compare = req.body.compare,
        update = req.body.set,
        err = null;

    if (typeof compare !== "object") {
        err = new Error("compare should be an object");
    } else if (typeof update !== "object") {
        err = new Error("update should be an object");
    }

    if (err) {
        self.logger_.error(err.message);
        res.json(415, { "error" : { "code": 1001, "message": err.message }});
        return;
    }

    mongodb.openMongodbCollection(VaticanControllerConfig, req.params.resource)
        .then(function (collection) {
            var options = {},
                sort = {},
                defer = Q.defer();
            collection.findAndModify(compare, sort, update, options,
                function (err, record) {
                    collection.close();
                    if (err) {
                        defer.reject(new Error(err));
                        return;
                    }
                    if (!record) {
                        self.logger_.debug("Cas, no such record.");
                        //defer.reject(new Error('Cas, no such record.'));
                        res.json(200, {
                            "result": {
                                "affected": 0,
                                "data": {}
                            }
                        });
                        return;
                    }
                    self.logger_.info("Cas 1 record");
                    if (record._id) {
                        delete record._id;
                    }
                    res.json(200, {
                        "result": {
                            "affected": 1,
                            "data": record
                        }
                    });
                });
            return defer.promise;
        })
        .fail(function (err) {
            self.logger_.error(err.message);
            res.json(500, { "error" : {
                "code": 1002,
                "message": err.message
            }});
        });
};

/**
 * Counter, return {'counterName', value}, which value is a int, and add 1 every
 * request automatic. Of course, you can change the default step.
 * IMPORTENT: This operation is atomic.
 *
 * @method counter
 * @param {Object} req  http request object.
 * @param {Object} res, http response object.
 */
VaticanController.prototype.counter = function (req, res) {
    "use strict";
    var self = this,
        step = ((typeof req.body.step === 'undefined') && 1) || req.body.step,
        name = req.body.name,
        err, criteria, update;
    
    if ('string' !== typeof name) {
        err = new Error("Posted data should be an object, " +
                        "and contain counter name");
        self.logger_.error(err.message);
        res.json(415, { "error" : { "code": 1001, "message": err.message } });
        return;
    }

    criteria = {name: name};
    update = {"$inc": {value: step}};

    mongodb.openMongodbCollection(VaticanControllerConfig, 'counter')
        .then(function (collection) {
            var defer = Q.defer();
            collection.findAndModify(criteria, {}, update, {},
                function (err, record) {
                    collection.close();
                    if (err) {
                        defer.reject(new Error(err));
                        return;
                    }
                    if (!record) {
                        self.logger_.info("No such counter: " + name);
                        defer.reject(new Error('Can\'t find counter.'));
                        return;
                    }

                    if (record._id) {
                        delete record._id;
                    }
                    res.json(200, {
                        "result": {
                            "affected": 1,
                            "data": record
                        }
                    });
                });
            return defer.promise;
        })
        .fail(function (err) {
            self.logger_.error(err.message);
            res.json(500, { "error" : {
                "code": 1002,
                "message": err.message
            }});
        });
};

/**
 * Provide interface of db.collection.group, just like groupby for SQL.
 * @method group
 * @param {Object} req  http request object.
 * @param {Object} res, http response object.
 */
VaticanController.prototype.group = function (req, res) {
    "use strict";
    var self = this,
        group = {},
        operations = req.body.operations,
        err, max;

    group = {
        key: {},
        initial: {}
    };
    group.cond = req.body.criteria;
    if (typeof group.cond !== "object") {
        group.cond = {};
    }

    if (typeof operations.group.group_by !== "string") {
        err = new Error("group should has a property named group_by");
        self.logger_.error(err.message);
        res.json(415, { "error" : { "code": 1001, "message": err.message } });
        return;
    }
    group.key[operations.group.group_by] = true;

    // register the group_by operation.
    if (typeof operations.group.max === "string") {
        max = operations.group.max;
        group.initial[max] = 0;
        group.reduce = new Function('current', 'previous',
            'if (current["' + max + '"] > previous["' + max + '"]) {' +
            '    for (var key in current) {' +
            '        if (key === "_id") {' +
            '            continue;' +
            '        }' +
            '        previous[key] = current[key];' +
            '    }' +
            '}'
        );
    }

    if (! group.reduce || 'function' !== typeof group.reduce) {
        err = new Error("operations should contain" +
                        "a group_by operation like 'max'. ");
        self.logger_.error(err.message);
        res.json(415, { "error" : { "code": 1001, "message": err.message } });
        return;
    }

    mongodb.openMongodbCollection(VaticanControllerConfig, req.params.resource)
        .then(function (collection) {
            var defer = Q.defer();
            collection.group(group.key, group.cond, group.initial, group.reduce,
                    function (err, records) {
                collection.close();
                if (err) {
                    defer.reject(new Error(err));
                    return;
                }
                self.logger_.info("group read: " + records.length + " records");
                res.json(200, {
                    "result": {
                        "affected": records.length,
                        "data": records
                    }
                });
            });
            return defer.promise;
        })
        .fail(function (err) {
            self.logger_.error(err.message);
            res.json(500, { "error" : { "code": 1002, "message": err.message } });
        });

};

/**
 * Provide interface just return length of result.
 * @method count
 * @param {paramType} paramName Description of param
 * @return {returnType} Description of the return value
 */
VaticanController.prototype.count = function (req, res) {
    "use strict";
    var self = this,
        criteria = req.body.criteria,
        cursor;

    mongodb.openMongodbCollection(VaticanControllerConfig, req.params.resource)
        .then(function (collection) {
            var defer = Q.defer();
            cursor = collection.find(criteria);
            cursor.count(function (err, count) {
                collection.close();
                if (err) {
                    defer.reject(new Error(err));
                }
                self.logger_.info("count " + count + " records");
                res.json(200, {
                    "result": {
                        "affected": count
                    }
                });
            });
            return defer.promise;
        })
        .fail(function (err) {
            self.logger_.error(err.message);
            res.json(500, { "error" : { "code": 1002, "message": err.message } });
        });
};

module.exports = VaticanController;
