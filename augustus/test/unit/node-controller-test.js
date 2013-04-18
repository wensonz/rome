/*
var libPath = process.env['JSCOV'] ? './lib-cov' : './lib',
    NodeController = require(libPath + '/node-controller.js'),
    romeClient = require('rome-client'),
    should = require('should');


describe('node-controller', function() {
    'use strict';

    describe('#update', function () {
        it('should successfully update node data.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/counter',
                    'res': { 
                        'result': {
                            'affected': 1,
                            'data': {
                                'name': 'revision',
                                'value': 11115
                            }
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/node/read',
                    'res': {
                        'result': {
                            'affected': 1,
                            'data': [
                                {
                                    'name': 'Mars80', 
                                    'revision': 11111
                                }
                            ]
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/node_history/create',
                    'res': { 
                        'result': {
                            'affected': 1
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/node/cas',
                    'res': { 
                        'result': {
                            'affected': 1,
                            'data': [
                                {
                                    'name': 'Mars80', 
                                    'revision': 11115
                                }
                            ]
                        }
                    }
                }
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Mars80',
                'revision': 11111,
                'roles': ["Apache", "IDC-zjm"],
                'changelog': 'add new data'
            };
            var res = {};
            res.json = function (status, body) {
                body.result.revision.should.equal(11115);
                done();
            };
            var controller = new NodeController();
            controller.update(req, res);
        });
        it('should get error when parameter length beyond limit.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Mars80Mars80Mars80Mars80Mars80Mars80Mars80Mars80Mars80Mars80Mars80Mars80',
                'revision': 11111,
                'roles': ["Apache", "IDC-zjm"],
                'changelog': 'add new data'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new NodeController();
            controller.update(req, res);
        });
        it('should get error when something was wrong in subclass method invocation', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/counter',
                    'res': { 
                        'result': {
                            'affected': 1,
                            'data': {
                                'name': 'revision',
                                'value': 11115
                            }
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/node/read',
                    'err': {
                        'error': {
                            'code': 1001
                        }
                    }
                },
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Mars80',
                'revision': 11111,
                'roles': ["Apache", "IDC-zjm"],
                'changelog': 'add new data'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4301);
                done();
            };
            var controller = new NodeController();
            controller.update(req, res);
        });
    });

    describe('#read', function () {
        it('should get current node data.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/node/read',
                    'res': {
                        'result': {
                            'affected': 1,
                            'data': [
                                {
                                    'name': 'ApacheConfTpl', 
                                    'revision': 11111
                                }
                            ]
                        }
                    }
                },
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Mars80'
            };
            var res = {};
            res.json = function (status, body) {
                body.result.revision.should.equal(11111);
                done();
            };
            var controller = new NodeController();
            controller.read(req, res);
        });
        it('should get error when parameter length beyond limit.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Mars80Mars80Mars80Mars80Mars80Mars80Mars80Mars80Mars80Mars80Mars80'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new NodeController();
            controller.read(req, res);
        });
        it('should get error when something was wrong in subclass method invocation', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/node/read',
                    'err': {
                        'error': {
                            'code': 1001
                        }
                    }
                }
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Mars80'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4302);
                done();
            };
            var controller = new NodeController();
            controller.read(req, res);
        });
    });

    describe('#delete', function () {
        it('should delete current node data.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/node/read',
                    'res': {
                        'result': {
                            'affected': 1,
                            'data': [
                                {
                                    'name': 'Mars80', 
                                    'revision': 11111
                                }
                            ]
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/node_history/create',
                    'res': { 
                        'result': {
                            'affected': 1
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/node/delete',
                    'res': {
                        'result': {
                            'affected': 1
                        }
                    }
                }
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Mars80'
            };
            var res = {};
            res.json = function (status, body) {
                body.should.eql({});
                done();
            };
            var controller = new NodeController();
            controller.delete(req, res);
        });
        it('should get error when parameter length beyond limit.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Mars80Mars80Mars80Mars80Mars80Mars80Mars80Mars80Mars80Mars80Mars80'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new NodeController();
            controller.delete(req, res);
        });
        it('should get error when something was wrong in subclass method invocation', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/node/read',
                    'err': {
                        'error': {
                            'code': 1001
                        }
                    }
                }
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Mars80'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4303);
                done();
            };
            var controller = new NodeController();
            controller.delete(req, res);
        });
    });

    describe('#history', function () {
        it('should get node history data.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/node_history/read',
                    'res': {
                        'result': {
                            'affected': 2,
                            'data': [
                                {
                                    'name': 'Mars80', 
                                    'revision': 11111
                                },
                                {
                                    'name': 'Mars80', 
                                    'revision': 11113
                                }
                            ]
                        }
                    }
                }
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'criteria': {
                    'name': 'Mars80'
                }
            };
            var res = {};
            res.json = function (status, body) {
                body.result.affected.should.equal(2);
                body.result.data[0].revision.should.equal(11111);
                body.result.data[1].revision.should.equal(11113);
                done();
            };
            var controller = new NodeController();
            controller.history(req, res);
        });
        it('should get error when bad parameter type.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'criteria': 'name == Mars80'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new NodeController();
            controller.history(req, res);
        });
        it('should get error when parameter length beyond limit.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                "criteria": {
                    'name': 'Mars80'
                },
                "operations": {
                    "limit": 50
                }
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new NodeController();
            controller.history(req, res);
        });
        it('should get error when something was wrong in subclass method invocation', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/node_history/read',
                    'err': {
                        'error': {
                            'code': 1001
                        }
                    }
                }
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                "criteria": {
                    'name': 'Mars80'
                }
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4304);
                done();
            };
            var controller = new NodeController();
            controller.history(req, res);
        });
    });
});
*/
