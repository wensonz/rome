var request = require('request'),
    should = require('should'),
    fs = require('fs'),
    dns = require('dns'),
    async = require('async'),
    mongodb = require('mongodb'),
    config = require('./config.json'),
    spawn = require('child_process').spawn;

var apiServer = config.apiServer,
    dbHost = config.db.mongodb.host,
    dbPort = config.db.mongodb.port,
    rsName = config.db.mongodb.repl_options.rs_name;

//var zoneAndAssetsData = require('./data/zone-assets.js');
var zoneAndAssetsData = [];

function eraseData (host, port, database, collections, rs, callback) {
    dns.resolve4(host, function (error, addresses) {
        if (error) {
            callback('resolve DB servers address failed: ' + error.toString(), null);
            return;
        }
        var servers = addresses.map(function (server) {
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

function resetCounter (name, callback) {
    var options = {
        url: 'http://' + apiServer + '/vatican/counter/update',
        method: "POST",
        json: true,
        body: {
            "criteria": {
                "name": name
            },
            "update": {
                "$set": {
                    "value": 1
                }
            }
        }
    };
    request(options, function (err, res, body) {
        if (err) {
            callback('reset counter failed: ' + err.toString(), null);
        }
        else if (body.error) {
            callback('reset counter failed: ' + body.error.message, null);
        }
        else {
            callback(null, 'ok');
        };
    })
}

function populateData (dataDir, callback) {
    try {
        var stats = fs.lstatSync(dataDir);
        if (!stats.isDirectory()) {
            callback(dataDir + ' is not directory', null);
            return;
        }
    }
    catch(e) {
        callback(e.toString(), null);
        return;
    }
    var dataCategory = ['role', 'template'];
    for (var i = 0; i < dataCategory.length; i++) {
        var dataCategoryPath = dataDir + '/' + dataCategory[i];
        try {
            stats = fs.lstatSync(dataCategoryPath);
            if (stats.isDirectory()) {
                var files = fs.readdirSync(dataCategoryPath);
                for (var x = 0; x < files.length; x++) {
                    zoneAndAssetsData.push({
                        'api': '/configuration/' + dataCategory[i] + '/update',
                        'body': require(dataCategoryPath + '/' + files[x])
                    });
                };
            }
        }
        catch(e) {
        }
    };
    async.forEachSeries(zoneAndAssetsData, function (argument, callback) {
        var options = {
            url: 'http://' + apiServer + argument.api,
            method: "POST",
            json: true,
            body: argument.body
        };
        request(options, function (err, res, body) {
            if (err) {
                callback("populate data error: " + err.toString());
            }
            else if (body.error) {
                callback("populate data error: " + JSON.stringify(body.error));
            }
            else {
                callback();
            };
        })
    }, function (err) {
        if (err) {
            callback(err, null);
        }
        else {
            callback(null, 'ok');
        };
    });
}

rmDir = function(dirPath) {
    try {
        var files = fs.readdirSync(dirPath);
    }
    catch(e) {
        return;
    };
    if (files.length > 0)
    {
        for (var i = 0; i < files.length; i++) {
            var filePath = dirPath + '/' + files[i];
            if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
            }
            else {
                rmDir(filePath);
            };
        }
    }
    fs.rmdirSync(dirPath);
};

function toFiles (destinationDir, data, callback) {
    var nodeFiles = [];
    for (var node in data) {
        var nodeDir = destinationDir + '/' + node;
        rmDir(nodeDir);
        fs.mkdirSync(nodeDir);
        for (var file in data[node]["files"]) {
            var item = {
                "node": node,
                "fileName": "",
                "fileURL": ""
            };
            item.fileName = file;
            item.fileURL = data[node]["files"][file];
            nodeFiles.push(item);
        };
    };
    async.forEach(nodeFiles, function (item, callback) {
        request({"url": item.fileURL}, function (error, response, body) {
            if (error) {
                callback("fetch file content by URL error: " + error.toString());
            }
            else {
                var fileContent = new Buffer(JSON.parse(body).content, 'base64');
                fs.writeFile(destinationDir + '/' + item.node + '/' + item.fileName, fileContent.toString(), function (err) {
                    if (err) {
                        callback("write file error: " + err.toString());
                    }
                    else {
                        callback();
                    };
                });
            };
        });
    }, function (err) {
        if (err) {
            callback(err, null);
        }
        else {
            callback(null, nodeFiles);
        };
    });
}

function diff (fileA, fileB, callback) {
    var diff = spawn('diff', ['--ignore-all-space', fileA, fileB]);
    var output = {
        "stdout": "",
        "stderr": ""
    };
    diff.stdout.on('data', function (data) {
        output['stdout'] += data;
    });
    diff.stderr.on('data', function (data) {
        output['stderr'] += data;
    });
    diff.on('exit', function (code) {
        callback({"code": code, "message": output});
    });
}

function apiCall(api, body, callback) {
    var options = {
        "method": "POST",
        "url": "http://" + apiServer + api,
        "json": true,
        "body": body
    };
    request(options, function (error, response, body) {
        if (error) {
            callback(error.toString(), null);
        }
        else if (body.error) {
            callback(JSON.stringify(body.error), null);
        }
        else {
            callback(null, body.result);
        };
    });
};

describe('Augustus', function () {
    'use strict';
    before(function (done) {
        async.series([
            /*
            function(next){
                var collections = ["zone", "assets"];
                eraseData(dbHost, dbPort, "test", collections, rsName, function (error, result) {
                    if (error) {
                        next(error, null);
                    }
                    else {
                        next(null, result);
                    };
                });
            },
            */
            function(next){
                var collections = ["role", "role_history", "template", "template_history", "tag"];
                eraseData(dbHost, dbPort, "configuration", collections, rsName, function (error, result) {
                    if (error) {
                        next(error, null);
                    }
                    else {
                        next(null, result);
                    };
                });
            },
            function(next){
                resetCounter("revision", function (error, result) {
                    if (error) {
                        next(error, null);
                    }
                    else {
                        next(null, result);
                    };
                });
            },
            function(next){
                populateData(__dirname + '/data', function (error, result) {
                    if (error) {
                        next(error, null);
                    }
                    else {
                        next(null, result);
                    };
                });
            },
        ],
        function(err, result){
            if (err) {
                done("Test data preparation failed: " + err.toString());
            } else {
                done();
            };
        });
    });

    describe('#/configuration/generate', function () {
        it('1. should generate virtual host configuration file, single role, no merge.', function (done) {
            async.waterfall([
                function (next) {
                    var body = {
                        "nodes": {
                            "name": "10.44.6.81"
                        },
                        "configuration": {
                            "files": ["vip.book.sina.com.cn_vhost_configuration"]
                        }
                    };
                    apiCall('/configuration/generate', body, next);
                },
                function (generatedData, next) {
                    toFiles(__dirname + '/cases/1/generated-files', generatedData, function (err, nodeFiles) {
                        if (err) {
                            next(err, null);
                        }
                        else {
                            next(null, nodeFiles);
                        };
                    });
                },
                function (nodeFiles, next) {
                    async.map(nodeFiles, function (item, callback) {
                        var generatedFile = __dirname + '/cases/1/generated-files/' + item.node + '/' + item.fileName;
                        var sourceFile = __dirname + '/cases/1/source-files/' + item.node + '/' + item.fileName;
                        diff(generatedFile, sourceFile, function (result) {
                            if (result.code != 0) {
                                callback(JSON.stringify(result.message), null);
                            }
                            else {
                                callback(null, result);
                            };
                        });
                    }, function (err, results) {
                        if (err) {
                            next(err, null);
                        }
                        else {
                            next(null, results);
                        };
                    });
                }
            ],
            function(err, result){
                if (err) {
                    done(err);
                } else {
                    done();
                };
            });
        });
        it('2. should generate apache-2.2.22 main configuration file with merged specific data of ZaoJunMiao IDC', function (done) {
            async.waterfall([
                function (next) {
                    var body = {
                        "nodes": ["10.44.6.82"],
                        "configuration": {
                            "files": ["apache_2.2.22_main_configuration"]
                        }
                    };
                    apiCall('/configuration/generate', body, next);
                },
                function (generatedData, next) {
                    toFiles(__dirname + '/cases/2/generated-files', generatedData, function (err, nodeFiles) {
                        if (err) {
                            next(err, null);
                        }
                        else {
                            next(null, nodeFiles);
                        };
                    });
                },
                function (nodeFiles, next) {
                    async.map(nodeFiles, function (item, callback) {
                        var generatedFile = __dirname + '/cases/2/generated-files/' + item.node + '/' + item.fileName;
                        var sourceFile = __dirname + '/cases/2/source-files/' + item.node + '/' + item.fileName;
                        diff(generatedFile, sourceFile, function (result) {
                            if (result.code != 0) {
                                callback(JSON.stringify(result.message), null);
                            }
                            else {
                                callback(null, result);
                            };
                        });
                    }, function (err, results) {
                        if (err) {
                            next(err, null);
                        }
                        else {
                            next(null, results);
                        };
                    });
                }
            ],
            function(err, result){
                if (err) {
                    done(err);
                } else {
                    done();
                };
            });
        });
        it('3. should generate multiple configuration files with merged multiple roles.', function (done) {
            async.waterfall([
                function (next) {
                    var body = {
                        "nodes": ["10.44.6.83"],
                        "configuration": {
                            "files": []
                        }
                    };
                    apiCall('/configuration/generate', body, next);
                },
                function (generatedData, next) {
                    toFiles(__dirname + '/cases/3/generated-files', generatedData, function (err, nodeFiles) {
                        if (err) {
                            next(err, null);
                        }
                        else {
                            next(null, nodeFiles);
                        };
                    });
                },
                function (nodeFiles, next) {
                    async.map(nodeFiles, function (item, callback) {
                        var generatedFile = __dirname + '/cases/3/generated-files/' + item.node + '/' + item.fileName;
                        var sourceFile = __dirname + '/cases/3/source-files/' + item.node + '/' + item.fileName;
                        diff(generatedFile, sourceFile, function (result) {
                            if (result.code != 0) {
                                callback(JSON.stringify(result.message), null);
                            }
                            else {
                                callback(null, result);
                            };
                        });
                    }, function (err, results) {
                        if (err) {
                            next(err, null);
                        }
                        else {
                            next(null, results);
                        };
                    });
                }
            ],
            function(err, result){
                if (err) {
                    done(err);
                } else {
                    done();
                };
            });
        });
        it('4. should generate multiple configuration files with merged multiple roles for multiple nodes.', function (done) {
            async.waterfall([
                function (next) {
                    var body = {
                        "nodes": {
                            "$or": [
                                {"name": "10.44.6.83"},
                                {"name": "10.44.6.84"}
                            ]
                        },
                        "configuration": {
                            "files": []
                        }
                    };
                    apiCall('/configuration/generate', body, next);
                },
                function (generatedData, next) {
                    toFiles(__dirname + '/cases/4/generated-files', generatedData, function (err, nodeFiles) {
                        if (err) {
                            next(err, null);
                        }
                        else {
                            next(null, nodeFiles);
                        };
                    });
                },
                function (nodeFiles, next) {
                    async.map(nodeFiles, function (item, callback) {
                        var generatedFile = __dirname + '/cases/4/generated-files/' + item.node + '/' + item.fileName;
                        var sourceFile = __dirname + '/cases/4/source-files/' + item.node + '/' + item.fileName;
                        diff(generatedFile, sourceFile, function (result) {
                            if (result.code != 0) {
                                callback(JSON.stringify(result.message), null);
                            }
                            else {
                                callback(null, result);
                            };
                        });
                    }, function (err, results) {
                        if (err) {
                            next(err, null);
                        }
                        else {
                            next(null, results);
                        };
                    });
                }
            ],
            function(err, result){
                if (err) {
                    done(err);
                } else {
                    done();
                };
            });
        });
        it('5. should generate apache-2.2.22 main configuration file, with merge, with tag', function (done) {
            async.waterfall([
                function (next) {
                    var body = {
                        "criteria": {
                            "$or": [
                                {"name": "10.44.6.85"},
                                {"name": "10.44.6.75"}
                            ]
                        }
                    };
                    apiCall('/configuration/role/read', body, next);
                },
                function (roleData, next) {
                    async.forEachSeries(roleData.data, function (item, callback) {
                        item.includes = ["apache_2.2.22", "zjm"];
                        item.changelog = "change zone to zjm";
                        apiCall('/configuration/role/update', item, function (error, result) {
                            if (error) {
                                callback(error);
                            }
                            else {
                                callback();
                            };
                        });
                    }, function (err) {
                        if (err) {
                            next(err, null);
                        }
                        else {
                            next(null, true);
                        };
                    });
                },
                function (updateResult, next) {
                    var body = {
                        "name": "ZaoJunMiao_apache_2.2.22_stable",
                        "changelog": "add a new tag."
                    }
                    apiCall('/configuration/tag/create', body, function (error, result) {
                        if (error) {
                            next(error, null);
                        }
                        else {
                            next(null, "ZaoJunMiao_apache_2.2.22_stable");
                        };
                    });
                },
                function (tagName, next) {
                    var body = {
                        "criteria": {
                            "$or": [
                                {"name": "10.44.6.85"},
                                {"name": "10.44.6.75"}
                            ]
                        }
                    };
                    apiCall('/configuration/role/read', body, function (error, result) {
                        if (error) {
                            next(error, null);
                        }
                        else {
                            next(null, tagName, result);
                        };
                    });
                },
                function (tagName, roleData, next) {
                    async.forEachSeries(roleData.data, function (item, callback) {
                        item.includes = ["apache_2.2.22", "tj"];
                        item.changelog = "change zone to tj";
                        apiCall('/configuration/role/update', item, function (error, result) {
                            if (error) {
                                callback(error);
                            }
                            else {
                                callback();
                            };
                        });
                    }, function (err) {
                        if (err) {
                            next(err, null);
                        }
                        else {
                            next(null, tagName);
                        };
                    });
                },
                function (tagName, next) {
                    var body = {
                        "nodes": ["10.44.6.85", "10.44.6.75"],
                        "tag": "ZaoJunMiao_apache_2.2.22_stable",
                        "configuration": {
                            "files": ["apache_2.2.22_main_configuration"]
                        }
                    };
                    apiCall('/configuration/generate', body, function (error, result) {
                        if (error) {
                            next(error, null);
                        }
                        else {
                            next(null, result);
                        };
                    });
                },
                function (generatedData, next) {
                    toFiles(__dirname + '/cases/5/generated-files', generatedData, function (err, nodeFiles) {
                        if (err) {
                            next(err, null);
                        }
                        else {
                            next(null, nodeFiles);
                        };
                    });
                },
                function (nodeFiles, next) {
                    async.map(nodeFiles, function (item, callback) {
                        var generatedFile = __dirname + '/cases/5/generated-files/' + item.node + '/' + item.fileName;
                        var sourceFile = __dirname + '/cases/5/source-files/' + item.node + '/' + item.fileName;
                        diff(generatedFile, sourceFile, function (result) {
                            if (result.code != 0) {
                                callback(JSON.stringify(result.message), null);
                            }
                            else {
                                callback(null, result);
                            };
                        });
                    }, function (err, results) {
                        if (err) {
                            next(err, null);
                        }
                        else {
                            next(null, results);
                        };
                    });
                }
            ],
            function(err, result){
                if (err) {
                    done(err);
                } else {
                    done();
                };
            });
        });
        it('6. should generate file with merged data and resolved "module" conflict.', function (done) {
            async.waterfall([
                function (next) {
                    var body = {
                        "nodes": ["10.44.6.86"],
                        "configuration": {
                            "files": ["apache_2.2.22_main_configuration"]
                        }
                    };
                    apiCall('/configuration/generate', body, next);
                },
                function (generatedData, next) {
                    toFiles(__dirname + '/cases/6/generated-files', generatedData, function (err, nodeFiles) {
                        if (err) {
                            next(err, null);
                        }
                        else {
                            next(null, nodeFiles);
                        };
                    });
                },
                function (nodeFiles, next) {
                    async.map(nodeFiles, function (item, callback) {
                        var generatedFile = __dirname + '/cases/6/generated-files/' + item.node + '/' + item.fileName;
                        var sourceFile = __dirname + '/cases/6/source-files/' + item.node + '/' + item.fileName;
                        diff(generatedFile, sourceFile, function (result) {
                            if (result.code != 0) {
                                callback(JSON.stringify(result.message), null);
                            }
                            else {
                                callback(null, result);
                            };
                        });
                    }, function (err, results) {
                        if (err) {
                            next(err, null);
                        }
                        else {
                            next(null, results);
                        };
                    });
                }
            ],
            function(err, result){
                if (err) {
                    done(err);
                } else {
                    done();
                };
            });
        });
        it('7. should get error when "module" conflict can not be resolved.', function (done) {
            var body = {
                "nodes": ["10.44.6.87"],
                "configuration": {
                    "files": ["apache_2.2.22_main_configuration"]
                }
            };
            apiCall('/configuration/generate', body, function (error, result) {
                JSON.parse(error).code.should.equal(4570);
                done();
            });
        });
        it('8. should get error when some nodes do not exist.', function (done) {
            var body = {
                "nodes": ["10.44.6.87", "10.44.6.100"],
                "configuration": {
                    "files": ["apache_2.2.22_main_configuration"]
                }
            };
            apiCall('/configuration/generate', body, function (error, result) {
                JSON.parse(error).code.should.equal(4532);
                done();
            });
        });
    });
});
