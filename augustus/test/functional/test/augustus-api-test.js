/** 
*Functional test for component Augustus 
*/

var fs = require('fs'),
    http = require('http'),
    assert = require('assert'),
    request = require('request'),
    dns = require('dns'),
    async = require('async'),
    mongodb = require('mongodb'),
    config = require('./config.json'),
    specs = require('./specs.json');

var apiServer = config.apiServer,
    dbHost = config.db.mongodb.host,
    dbHostIPAddresses = [],
    dbPort = config.db.mongodb.port,
    rsName = config.db.mongodb.repl_options.rs_name;

function eraseData (hostname, port, database, collections, rs, callback) {
    dns.resolve4(hostname, function (error, IPAddresses) {
        if (error) {
            callback('resolve DB servers address failed: ' + error.toString(), null);
            return;
        }
        dbHostIPAddresses = IPAddresses;
        var servers = IPAddresses.map(function (server) {
            return new mongodb.Server(server, port);
        });
        new mongodb.Db(database, new mongodb.ReplSetServers(servers, {"rs_name": rs}), {safe:true})
        .open(function (error, db) {
            if (error) {
                callback('open DB failed: ' + error.toString(), null);
                return;
            } else {
                async.forEach(collections, function (collection, callback) {
                    db.collection(collection, function (error, collection) {
                        if (error) {
                            callback(error.toString());
                        }
                        else {
                            collection.remove(function (error, count) {
                                if (error) {
                                    callback(error.toString());
                                }
                                else {
                                    callback();
                                };
                            });
                        };
                    });
                }, function (err) {
                    db.close();
                    if (err) {
                        callback(err, null);
                    }
                    else {
                        callback(null, 'ok');
                    };
                });
            };
        });
    });
}

describe('Augustus', function () {
    'use strict';
    before(function (done) {
        var collections = ["role", "role_history", "template", "template_history", "tag"];
        eraseData(dbHost, dbPort, "configuration", collections, rsName, function (error, result) {
            if (error) {
                done(error);
            }
            else {
                done();
            };
        });
    });

    specs.forEach(function (spec) {
        describe('#' + spec.api, function () {
            var cases = spec.cases;

            before(function (done) {
                var counter = {
                    url: 'http://' + config.apiServer + '/vatican/counter/update',
                    method: "POST",
                    json: true,
                    body: {
                        "criteria": {
                            "name": "revision"
                        },
                        "update": {
                            "$set": {
                                "value": 2
                            }
                        }
                    }
                    
                };
                request(counter, function (err, res, body) {
                    done();
                })
            });

            cases.forEach(function (item) {
                it(item.description, function (done) {
                    var resource = item.input.url,
                        regex = /\/(.*)\/(.*)\/(.*)/,
                        match = regex.exec(resource),
                        output = null,
                        rmap = null,
                        port = null;
/*
                    if (/vatican/.test(item.input.url)) {
                        port = 3000;
                    } else {
                        port = config.api.port;
                    }
*/
                    item.input.url = 'http://' + config.apiServer + item.input.url;

                    request(item.input, function (err, res, body) {
                        if (err) {
                            done('Call ' + item.input.url + ' failed, ' + error.toString());
                        }

                        if (res.statusCode === 200) {
                            // Replica configuration
                            var replSet = new mongodb.ReplSetServers( [
                                new mongodb.Server( dbHostIPAddresses[0], dbPort, { auto_reconnect: true } ),
                                new mongodb.Server( dbHostIPAddresses[1], dbPort, { auto_reconnect: true } )
                                ],
                                { rs_name: rsName }
                            );

                            if (/history?$/.test(item.input.url) && match[2] !== 'tag') {
                                rmap = config.db.rmap[match[2] + '_history'];
                                JSON.stringify(body.result.data[0].revision).should.equal(JSON.stringify(item.output));
                            } else if (/read?$/.test(item.input.url) && match[2] !== 'tag') {
                                rmap = config.db.rmap[match[2]];
                                if (body.result.affected == 0) {
                                    JSON.stringify(body.result.data).should.equal(JSON.stringify(item.output));
                                } else {
                                    JSON.stringify(body.result.data[0].revision).should.equal(JSON.stringify(item.output));
                                }
                            } else if (/vatican/.test(item.input.url)) {
                                rmap = config.db.rmap[match[2]];
                                JSON.stringify(body.result.affected).should.equal(JSON.stringify(item.output));
                            } else if (/delete?$/.test(item.input.url)) {
                                rmap = config.db.rmap[match[2]];
                                JSON.stringify(body).should.equal(JSON.stringify(item.output));
                            } else if (/read?$/.test(item.input.url) && match[2] === 'tag'){
                                rmap = config.db.rmap[match[2]];
                                if (body.result.affected === 0) {
                                    JSON.stringify(body.result.data).should.equal(JSON.stringify(item.output));
                                } else {
                                    JSON.stringify(body.result.data[0].revision).should.equal(JSON.stringify(item.output));
                                }
                                
                            } else {
                                rmap = config.db.rmap[match[2]];
                                if (body.result.revision == undefined) {
                                    JSON.stringify(body.result).should.equal(JSON.stringify(item.output));
                                } else {
                                    JSON.stringify(body.result.revision).should.equal(JSON.stringify(item.output));
                                }
                            }

                            var db = new mongodb.Db(rmap.dbname, replSet);

                            setTimeout(function () {
                                db.open(function(err, db) {
                                    db.serverConfig._state.secondaries = {};
                                    db.collection(rmap.collection, function(err, collection) {

                                        collection.find(item.data, {_id: 0}).toArray(function(err, items) {
                                            if (err) {
                                                done('Find ' + config.db.rmap[match[2]].collection + ' failed, ' + error.toString());
                                            }

                                            if (items[0] !== undefined) {
                                                JSON.stringify(items[0].revision).should.equal(JSON.stringify(item.result));
                                            }

                                        });
                                    });
                                    db.close();
                                    done();
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
    
    /*
    after(function (done) {
        var historyRemove = {
            url: 'http://' + config.api.host + ':3000/vatican/' + match[1] + '_history/delete',
            method: "POST",
            json: true,
            body: {
                "criteria": {
                    "name": "web2"
                }
            }
        };
        request(historyRemove, function (err, res, body) {
            console.log(err);
            console.log(body);
            done();
        })
    });
    */
});
