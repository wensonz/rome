var libpath = process.env.JSCOV ? './lib-cov' : './lib',
    Vatican = require(libpath + '/vatican.js'),
    mongodb = require('mongodb-ext'),
    assert = require('assert'),
    Q = require('q');



describe('Vatican', function () {
    'use strict';
    var vatican = null;

    beforeEach(function () {
        vatican = new Vatican();
        vatican.logger_ = {
            info: function () {},
            debug: function () {},
            error: function () {}
        };
    });

    afterEach(function () {
        vatican = null;
    });

    describe('#create', function () {
        it('should insert Vatican in MongoDB', function (done) {
            var records = [{ "name": "www.sina.com.cn" }],
                req = {
                    'params': {'resource': 'naming'},
                    'body': records,
                },
                res = {
                    'json' : function (code, obj) {
                            assert.equal(obj.result.affected, 1);
                        }
                },
                err = null,
                collection = {
                    'insert': function (content, safe, callback) {
                        assert.equal(req.body, content);
                        callback(err, records);
                    },
                    'close': function  () {}
                };

            mongodb.openMongodbCollection = function () {
                return Q.fcall(function () {
                    return collection;
                });
            };
            vatican.create(req, res);
            done();
        });

        it('should insert_error data in MongoDB', function (done) {
            var records = [{ "name": "www.sina.com.cn" }],
                err = new Error('test error'),
                req = {
                    'params': {'resource': 'naming'},
                    'body': records,
                },
                res = {
                    'json': function (code, obj) {
                        assert.equal(obj.error.message, err.message);
                    },
                },
                collection = {
                    'insert': function (content, safe, callback) {
                        assert.equal(req.body, content);
                        callback(err, records);
                    },
                    'close': function  () {}
                };


            mongodb.openMongodbCollection = function () {
                return Q.fcall(function () {
                    return collection;
                });
            };
            vatican.create(req, res);
            done();
        });
    });

    describe('#read', function () {
        it('should return data correctly.', function (done) {
            var err = null,
                records = ['test', 'test', 'test', 'test'],

                req = {
                    'params': {'resource': 'naming'},
                    'body': {
                        'criteria': {'c': 1},
                        'fields': {'f': true},
                        'operations': {'o': 2},
                    }
                },
                res = {
                    'json': function (code, obj) {
                        assert.equal(obj.result.data, records);
                        assert.equal(obj.result.affected, records.length);
                    }
                },
                cursor = {
                    'toArray': function (callback) {
                        callback(err, records);
                        done();
                    },
                },
                criteria_old = req.body.criteria,
                fields_old = req.body.fields,
                operations_old = req.body.operations,
                collection = {
                    'find': function (criteria, fields, operations) {
                        assert.equal(criteria_old.c, criteria.c);
                        assert.equal(fields_old.f, fields.f);
                        assert.equal(operations_old.o, operations.o);
                        return cursor;
                    },
                    'close': function  () {}
                };

            mongodb.openMongodbCollection = function () {
                return Q.fcall(function () {
                    return collection;
                });
            };
            vatican.read(req, res);
        });

        it('should return full length of data, when "skip" in' + 'operations',
                function (done) {

            var err = null,
                skip = 1,
                records = ['test', 'test', 'test', 'test'],

                req = {
                    'params': {'resource': 'naming'},
                    'body': {
                        'criteria': {'c': 1},
                        'fields': {'f': true},
                        'operations': {'skip': skip},
                    }
                },
                res = {
                    'json': function (code, obj) {
                        assert(obj.result.data.length === 3);
                        assert.equal(obj.result.affected, records.length);
                        done();
                    }
                },
                cursor = {
                    'toArray': function (callback) {
                        callback(err, records.slice(skip));
                    },
                    'count': function (callback) {
                        callback(err, records.length);
                    }
                },
                collection = {
                    'find': function () {
                        return cursor;
                    },
                    'close': function  () {}
                };

            mongodb.openMongodbCollection = function () {
                return Q.fcall(function () {
                    return collection;
                });
            };
            vatican.read(req, res);
        });

        it('should return full length of data, when "limit" in' + 'operations',
                function (done) {

            var err = null,
                limit = 1,
                records = ['test', 'test', 'test', 'test'],

                req = {
                    'params': {'resource': 'naming'},
                    'body': {
                        'criteria': {'c': 1},
                        'fields': {'f': true},
                        'operations': {'limit': limit},
                    }
                },
                res = {
                    'json': function (code, obj) {
                        assert(obj.result.data.length === 1);
                        assert.equal(obj.result.affected, records.length);
                        done();
                    }
                },
                cursor = {
                    'toArray': function (callback) {
                        callback(err, records.slice(0, limit));
                    },
                    'count': function (callback) {
                        callback(err, records.length);
                    }
                },
                collection = {
                    'find': function () {
                        return cursor;
                    },
                    'close': function  () {}
                };

            mongodb.openMongodbCollection = function () {
                return Q.fcall(function () {
                    return collection;
                });
            };
            vatican.read(req, res);
        });

        it('should find data_criteria type error', function (done) {
            var req = {
                    'params': {'resource': 'naming'},
                    'body': {
                        'criteria': '',
                    }
                },
                res = {
                    'json': function (code, obj) {
                        assert.equal(obj.error.code, 1001);
                        done();
                    }
                };
            vatican.read(req, res);
        });

        it('should find data error in MongoDB', function (done) {
            var err = new Error('test error'),
                records = 'test',
                req = {
                    'params': {'resource': 'naming'},
                    'body': {
                        'criteria': {'c': 1},
                        'fields': '',
                        'operations': '',
                    }
                },
                res = {
                    'json': function (code, obj) {
                        assert.equal(obj.error.code, 1001);
                    }
                },
                cursor = {
                    'toArray': function (callback) {
                        callback(err, records);
                        done();
                    },
                },
                collection = {
                    'find': function () {
                        return cursor;
                    },
                    'close': function  () {}
                };

            mongodb.openMongodbCollection = function () {
                return Q.fcall(function () {
                    return collection;
                });
            };
            vatican.read(req, res);
        });

        it('should return error if group_by isn\'t string', function (done) {
            var req = {
                    'params': {'resource': 'naming'},
                    'body': {
                        criteria: '',
                        operations: {
                            group: {group_by: 1}
                        }
                    }
                },
                res = {
                    'json': function (code, obj) {
                        assert.equal(obj.error.code, 1001);
                        done();
                    }
                };
            vatican.read(req, res);
        });

        it('should return error if max isn\'t string', function (done) {
            var req = {
                    'params': {'resource': 'naming'},
                    'body': {
                        criteria: '',
                        operations: {
                            group: {group_by: 'field', max: 1}
                        }
                    }
                },
                res = {
                    'json': function (code, obj) {
                        assert.equal(obj.error.code, 1001);
                        done();
                    }
                };
            vatican.read(req, res);
        });

        it('should return error, if openMongodbCollection return error',
                function (done) {
            var req = {},
                res = {};
            mongodb.openMongodbCollection = function () {
                var defer = Q.defer();
                defer.reject(new Error("db error"));
                return defer.promise;
            };
            req = {
                body: {
                    operations: {group: {group_by: "", max: ""}}
                },
                params: {
                    resource: {}
                }
            };
            res.json = function (code, err) {
                assert(500 === code);
                assert.deepEqual(err, {"error": {
                    "code": 1002,
                    "message": "db error"
                }});
                done();
            };
            vatican.read(req, res);
        });

        it('should return error, if group() return error', function (done) {
            var req = {},
                res = {},
                collection = {};

            collection.close = function () {};
            collection.group = function (key, cond, initial, reduce, callback) {
                assert.deepEqual(key, {"group_by": true});
                assert.deepEqual(cond, {"criteria": 1});
                assert.deepEqual(initial, {"max": 0});
                assert(typeof callback === 'function');
                callback('group error', null);
            };

            mongodb.openMongodbCollection = function () {
                var defer = Q.defer();
                defer.resolve(collection);
                return defer.promise;
            };
            req = {
                params: {resource: ""},
                body: {
                    criteria: {"criteria": 1},
                    operations: {group: {group_by: "group_by", max: "max"}}
                }
            };
            res.json = function (code, err) {
                assert(500 === code);
                assert.deepEqual(err, {"error": {
                    "code": 1002,
                    "message": "group error"
                }});
                done();
            };
            vatican.read(req, res);
        });

        it('should do group by correctly', function (done) {
            var req = {},
                res = {},
                collection = {},
                records = ["records"];

            collection.close = function () {};
            collection.group = function (key, cond, initial, reduce, callback) {
                callback(null, records);
            };

            mongodb.openMongodbCollection = function () {
                var defer = Q.defer();
                defer.resolve(collection);
                return defer.promise;
            };
            req = {
                params: {resource: ""},
                body: {
                    criteria: {"criteria": 1},
                    operations: {group: {group_by: "group_by", max: "max"}}
                }
            };
            res.json = function (code, res) {
                assert(200 === code);
                assert.deepEqual(res, {result: {
                    affected: 1,
                    data: records
                }});
                done();
            };
            vatican.read(req, res);
        });
    });

    describe('#update', function () {
        it('should update Vatican in MongoDB', function (done) {
            var err = null,
                counts = 2,
                req = {
                    'params': {'resource': 'naming'},
                    'body': {
                        'criteria': {'c': 1},
                        'update': {'e': 2},
                    }
                },
                res = {
                    'json': function (code, obj) {
                        assert.equal(obj.result.affected, counts);
                    }
                },
                criteria_old = req.body.criteria,
                update_old = req.body.update,
                collection = {
                    'update': function (criteria, update, safe, callback) {
                        assert.equal(criteria_old, criteria);
                        assert.equal(update_old, update);
                        callback(err, counts);
                    },
                    'close': function  () {}
                };

            mongodb.openMongodbCollection = function () {
                return Q.fcall(function () {
                    return collection;
                });
            };
            vatican.update(req, res);
            done();
        });

        it('should update data_criteria type error', function (done) {
            var req = {
                    'params': {'resource': 'naming'},
                    'body': {
                        'criteria': '',
                    }
                },
                res = {
                    'json': function (code, obj) {
                        assert.equal(obj.error.code, 1001);
                    }
                };
            vatican.update(req, res);
            done();
        });

        it('should update data_update type error', function (done) {
            var req = {
                    'params': {'resource': 'naming'},
                    'body': {
                        'criteria': {},
                        'update': ''
                    }
                },
                res = {
                    'json': function (code, obj) {
                        assert.equal(obj.error.code, 1001);
                    }
                };
            vatican.update(req, res);
            done();
        });

        it('should update data error in MongoDB', function (done) {
            var err = new Error('test error'),
                counts = 2,
                req = {
                    'params': {'resource': 'naming'},
                    'body': {
                        'criteria': {'c': 1},
                        'update': {'e': 2},
                    }
                },
                res = {
                    'json': function (code, obj) {
                        assert.equal(obj.error.code, 1002);
                    }
                },
                collection = {
                    'update': function (criteria, update, safe, callback) {
                        callback(err, counts);
                    },
                    'close': function  () {}
                };

            mongodb.openMongodbCollection = function () {
                return Q.fcall(function () {
                    return collection;
                });
            };
            vatican.update(req, res);
            done();
        });
    });

    describe('#delete', function () {
        it('should delete Vatican in MongoDB', function (done) {
            var err = null,
                counts = 1,
                req = {
                    'params': {'resource': 'naming'},
                    'body': {
                        'criteria': {'c': 1},
                    }
                },
                res = {
                    'json': function (code, obj) {
                        assert.equal(obj.result.affected, counts);
                    }
                },
                criteria_old = req.body.criteria,
                collection = {
                    'remove': function (criteria, safe, callback) {
                        assert.equal(criteria_old, criteria);
                        callback(err, counts);
                    },
                    'close': function  () {}
                };

            mongodb.openMongodbCollection = function () {
                return Q.fcall(function () {
                    return collection;
                });
            };
            vatican.delete(req, res);
            done();
        });

        it('should delete data_criteria type error', function (done) {
            var req = {
                    'params': {'resource': 'naming'},
                    'body': {
                        'criteria': '',
                    }
                },
                res = {
                    'json': function (code, obj) {
                        assert.equal(obj.error.code, 1001);
                    }
                };
            vatican.delete(req, res);
            done();
        });

        it('should delete data error in MongoDB', function (done) {
            var err = new Error('test error'),
                counts = 1,
                req = {
                    'params': {'resource': 'naming'},
                    'body': {
                        'criteria': {'c': 1},
                    }
                },
                res = {
                    'json': function (code, obj) {
                        assert.equal(obj.error.code, 1001);
                    }
                },
                collection = {
                    'remove': function (criteria, safe, callback) {
                        callback(err, counts);
                    },
                    'close': function  () {}
                };

            mongodb.openMongodbCollection = function () {
                return Q.fcall(function () {
                    return collection;
                });
            };
            vatican.delete(req, res);
            done();
        });
    });

    describe('#cas', function () {
        it('should return error, if criteria isn\'t object',
                function (done) {
            var res = {},
                req = {};

            res.json = function (code, err) {
                assert(415 === code);
                assert.deepEqual(err, {"error": {
                    "code": 1001,
                    "message": "compare should be an object"
                }});
                done();
            };
            req.body = {
                "compare": "not object"
            };
            vatican.cas(req, res);

        });

        it('should return error, if update isn\'t object',
                function (done) {
            var res = {},
                req = {};
            res.json = function (code, err) {
                assert(415 === code);
                assert.deepEqual(err, {"error": {
                    "code": 1001,
                    "message": "update should be an object"
                }});
                done();
            };
            req.body = {
                "compare": {},
                "set" : "not object"
            };
            vatican.cas(req, res);
        });

        it('should return error, if openMongodbCollection return error',
                function (done) {
            var req = {},
                res = {};
            mongodb.openMongodbCollection = function () {
                var defer = Q.defer();
                defer.reject(new Error("db error"));
                return defer.promise;
            };
            req = {
                body: {
                    "compare": {},
                    "set" : {}
                },
                params: {
                    resource: {}
                }
            };
            res.json = function (code, err) {
                assert(500 === code);
                assert.deepEqual(err, {"error": {
                    "code": 1002,
                    "message": "db error"
                }});
                done();
            };
            vatican.cas(req, res);
        });

        it('should return error, if findAndModify() return error',
                function (done) {
            var req = {},
                res = {},
                collection = {};

            collection.close = function () {};
            collection.findAndModify = function (criteria, sort, update,
                    options, callback) {
                assert.deepEqual(criteria, {});
                assert.deepEqual(sort, {});
                assert.deepEqual(update, {});
                assert.deepEqual(options, {});
                callback('findAndModify error', null);
            };

            mongodb.openMongodbCollection = function () {
                var defer = Q.defer();
                defer.resolve(collection);
                return defer.promise;
            };
            req = {
                body: {
                    "compare": {},
                    "set" : {}
                },
                params: {
                    resource: {}
                }
            };
            res.json = function (code, err) {
                assert(500 === code);
                assert.deepEqual(err, {"error": {
                    "code": 1002,
                    "message": "findAndModify error"
                }});
                done();
            };
            vatican.cas(req, res);
        });

        it('should return result correctly', function (done) {
            var req = {},
                res = {},
                collection = {},
                records = {
                    "_id": 11,
                    "data": "data"
                };

            collection.close = function () {};
            collection.findAndModify = function (criteria, sort, update,
                    options, callback) {
                callback(null, records);
            };

            mongodb.openMongodbCollection = function () {
                var defer = Q.defer();
                defer.resolve(collection);
                return defer.promise;
            };
            req = {
                body: {
                    "compare": {},
                    "set" : {}
                },
                params: {
                    resource: {}
                }
            };
            res.json = function (code, res) {
                assert(200 === code);
                assert.deepEqual(res, {"result": {
                    "affected": 1,
                    "data": {"data": "data"}
                }});
                done();
            };
            vatican.cas(req, res);
        });
    });

    describe('#counter', function () {
        it('should return error, if posted data isn\'t object,' +
                ' or name isn\'t string', function (done) {
            var res = {},
                req = {};

            res.json = function (code, err) {
                assert(415 === code);
                assert.deepEqual(err, {"error": {
                    "code": 1001,
                    "message": "Posted data should be an object, " +
                            "and contain counter name"
                }});
                done();
            };
            req.body = "body";
            vatican.counter(req, res);
        });

        it('should return error, if name isn\'t string', function (done) {
            var res = {},
                req = {};

            res.json = function (code, err) {
                assert(415 === code);
                assert.deepEqual(err, {"error": {
                    "code": 1001,
                    "message": "Posted data should be an object, " +
                            "and contain counter name"
                }});
                done();
            };
            req.body = {
                "name" : 1
            };
            vatican.counter(req, res);
        });

        it('should return error, if openMongodbCollection return error',
                function (done) {
            var req = {},
                res = {};
            mongodb.openMongodbCollection = function () {
                var defer = Q.defer();
                defer.reject(new Error("db error"));
                return defer.promise;
            };
            req = {
                body: {
                    "name": "counter name"
                },
                params: {
                    resource: {}
                }
            };
            res.json = function (code, err) {
                assert(500 === code);
                assert.deepEqual(err, {"error": {
                    "code": 1002,
                    "message": "db error"
                }});
                done();
            };
            vatican.counter(req, res);
        });

        it('should return error, if findAndModify() return error',
                function (done) {
            var req = {},
                res = {},
                collection = {};

            collection.close = function () {};
            collection.findAndModify = function (criteria, sort, update,
                    options, callback) {

                assert.deepEqual(criteria, {"name": "counter"});
                assert.deepEqual(sort, {});
                assert.deepEqual(update, {"$inc": {value: 1}});
                assert.deepEqual(options, {});
                callback('findAndModify error', null);
            };

            mongodb.openMongodbCollection = function (conf, coll) {
                var defer = Q.defer();
                assert('counter' === coll);
                defer.resolve(collection);
                return defer.promise;
            };
            req = {
                body: {
                    "name": "counter",
                }
            };
            res.json = function (code, err) {
                assert(500 === code);
                assert.deepEqual(err, {"error": {
                    "code": 1002,
                    "message": "findAndModify error"
                }});
                done();
            };
            vatican.counter(req, res);
        });

        it('should return error, if counter isn\'t exist', function (done) {
            var req = {},
                res = {},
                collection = {};

            collection.close = function () {};
            collection.findAndModify = function (criteria, sort, update,
                    options, callback) {
                callback(null, null);
            };

            mongodb.openMongodbCollection = function () {
                var defer = Q.defer();
                defer.resolve(collection);
                return defer.promise;
            };
            req = {
                body: {
                    "name": "counter",
                }
            };
            res.json = function (code, err) {
                assert(500 === code);
                assert.deepEqual(err, {"error": {
                    "code": 1002,
                    "message": "Can\'t find counter."
                }});
                done();
            };
            vatican.counter(req, res);
        });

        it('should return counter correctly', function (done) {
            var req = {},
                res = {},
                collection = {},
                record;

            record = {"_id": 1, "name": "counter"};
            collection.close = function () {};
            collection.findAndModify = function (criteria, sort, update,
                    options, callback) {
                callback(null, record);
            };

            mongodb.openMongodbCollection = function () {
                var defer = Q.defer();
                defer.resolve(collection);
                return defer.promise;
            };
            req = {
                body: {
                    "name": "counter",
                }
            };
            res.json = function (code, res) {
                assert(200 === code);
                assert.deepEqual(res, {"result": {
                    "affected": 1,
                    "data": record
                }});
                done();
            };
            vatican.counter(req, res);
        });
    });
});
