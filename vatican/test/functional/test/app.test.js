/**
*Functional test for component Vatican
*/

var request = require('request'),
    mongodb = require('mongodb'),
    config = require('./config.json'),
    specs = require('./specs.json');

describe('Vatican', function () {
    'use strict';
    specs.forEach(function (spec) {
        describe('#' + spec.api, function () {
            var cases = spec.cases;
            cases.forEach(function (item) {
                it(item.description, function (done) {
                    var resource = item.input.url,
                        regex = /\/vatican\/([^\/]*)(\/.*)?/,
                        match = regex.exec(resource);

                    item.input.url = 'http://' + config.api.host + ':' + config.api.port + item.input.url;

                    request(item.input, function (err, res, body) {
                        if (res.statusCode === 200) {

                            JSON.stringify(body.result).should.equal(JSON.stringify(item.output));

                            // Replica configuration
                            var replSet = new mongodb.ReplSetServers([
                                    new mongodb.Server('10.54.22.104', 9030, { auto_reconnect: true }),
                                    new mongodb.Server('10.54.22.107', 9030, { auto_reconnect: true })
                                ],
                                { rs_name: 'fabu' }
                            ),
                            db = new mongodb.Db(config.db.rmap[match[1]].dbname, replSet);

                            if (!item.data) { // some case don't want to check db result.
                                done();
                                return;
                            }

                            setTimeout(function () {
                                db.open(function (err, db) {
                                    if (err) {
                                        console.log(err);
                                        done();
                                        return;
                                    }
                                    db.serverConfig._state.secondaries = {};
                                    db.collection(config.db.rmap[match[1]].collection, function (err, collection) {
                                        collection.find(item.data, {_id: 0}).toArray(function (err, items) {
                                            if (items[0]) {
                                                JSON.stringify(items[0]).should.equal(JSON.stringify(item.result));
                                            }
                                            db.close();
                                            done();
                                        });
                                    });
                                });
                            }, 100);
                        } else {
                            body.should.have.property('error');
                            body.error.code.toString().should.equal(item.output);
                            done();
                        }
                    });
                });
            });
        });
    });
});
