var assert = require('assert'),
    mongodb_ext = require('./lib/mongodb-ext'),
    mongodb = require('mongodb'),
    dns = require('dns'),
    key = {};

for (key in require.cache) {
    if (require.cache.hasOwnProperty(key)) {
        if (key.indexOf('mongodb/index.js') > 0 && require.cache.hasOwnProperty(key)) {
            delete require.cache[key];
        }
    }
}

describe('mongodb_ext', function () {
    'use strict';
    var config = {
        'mongodb': {
            'host': 'localhost',
            'port': 7601,
            'repl_options': {'rs_name': 'fabu'},
            'collection': 'rome',
            'server_options': {},
            'db_options': {},
        },
    };

    it('should open a MongoDB Connection', function (done) {
        var err = null,
            collection_old = {},
            collection = function (err, collection_new) {
                assert.equal(collection_old, collection_new);
            },
            db = {
                'collection': function (name, callback) {
                    callback(err, collection);
                },
                'close': {
                    'bind': function () {},
                },
            };

        dns.resolve4 = function (dns_name, callback) {
            callback(null, ['127.0.0.1']);
        };
        mongodb.Db.prototype.open = function (callback) {
            callback(err, db);
        };
        mongodb_ext.openMongodbCollection(config);
        done();
    });

    it('should open a error MongoDB Connection', function (done) {
        var err = "test err",
            collection_old = {},
            collection = function (err, collection_new) {
                assert.equal(collection_old, collection_new);
            },
            db = {
                'collection': function (name, callback) {
                    callback(err, collection);
                },
            };

        dns.resolve4 = function (dns_name, callback) {
            callback(null, ['127.0.0.1']);
        };
        mongodb.Db.prototype.open = function (callback) {
            callback(err, db);
        };
        mongodb_ext.openMongodbCollection(config);
        done();
    });

    it('should open a error_dns MongoDB Connection', function (done) {
        var err = new Error('error dns');
        dns.resolve4 = function (dns_name, callback) {
            callback(err, ['127.0.0.1']);
        };
        try {
            mongodb_ext.openMongodbCollection(config);
        } catch (e) {
            assert.equal(e.message, err.message);
        }
        done();
    });
});
