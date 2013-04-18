var libPath = process.env['JSCOV'] ? './lib-cov' : './lib',
    RoleController = require(libPath + '/role-controller.js'),
    romeClient = require('rome-client'),
    should = require('should');


describe('role-controller', function() {
    'use strict';

    describe('#update', function () {
        it('should successfully update role data.', function (done) {
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
                    'action': '/vatican/configuration/role/read',
                    'res': {
                        'result': {
                            'affected': 1,
                            'data': [
                                {
                                    'name': 'Apache', 
                                    'revision': 11111
                                }
                            ]
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/role_history/create',
                    'res': { 
                        'result': {
                            'affected': 1
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/role/cas',
                    'res': { 
                        'result': {
                            'affected': 1,
                            'data': [
                                {
                                    'name': 'Apache', 
                                    'revision': 11111
                                }
                            ]
                        }
                    }
                }
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Apache',
                'revision': 11111,
                'includes': ['IDC-zjm'],
                'configuration': {
                    'files': [
                        {
                            'name': 'httpd.conf',
                            'path': '/usr/local/sinasrv2/etc',
                            'owner': 'root:root',
                            'permission': '0755',
                            'template': 'httpd.conf.tpl',
                            'data': {
                                "ServerName": "weibo.com"
                            }
                        }
                    ]
                },
                'changelog': 'add new data'
            };
            var res = {};
            res.json = function (status, body) {
                body.result.revision.should.equal(11115);
                done();
            };
            var controller = new RoleController();
            controller.update(req, res);
        });
        it('should get error when bad parameter type.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Apache',
                'revision': 11111,
                'includes': 'IDC-zjm'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new RoleController();
            controller.update(req, res);
        });
        it('should get error when bad parameter type in file object.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Apache',
                'revision': 11111,
                'includes': 'IDC-zjm',
                'configuration': {
                    'files': [
                        {
                        }
                    ]
                },
                'changelog': 'add new data'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new RoleController();
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
                    'action': '/vatican/configuration/role/read',
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
                'name': 'Apache',
                'revision': 11111,
                'includes': ['IDC-zjm'],
                'configuration': {
                    'files': [
                        {
                            'name': 'httpd.conf',
                            'path': '/usr/local/sinasrv2/etc',
                            'owner': 'root:root',
                            'permission': '0755',
                            'template': 'httpd.conf.tpl',
                            'data': {
                                "ServerName": "weibo.com"
                            }
                        }
                    ]
                },
                'changelog': 'add new data'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4101);
                done();
            };
            var controller = new RoleController();
            controller.update(req, res);
        });
    });

    describe('#read', function () {
        it('should get current role data.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/role/read',
                    'res': {
                        'result': {
                            'affected': 1,
                            'data': [
                                {
                                    'name': 'Apache', 
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
                'criteria': {
                    'name': 'Apache'
                }
            };
            var res = {};
            res.json = function (status, body) {
                body.result.data[0].revision.should.equal(11111);
                done();
            };
            var controller = new RoleController();
            controller.read(req, res);
        });
        it('should get error when parameter length beyond limit.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'criteria': 'name'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new RoleController();
            controller.read(req, res);
        });
        it('should get error when something was wrong in subclass method invocation', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/role/read',
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
                'criteria': {
                    'name': 'Apache'
                }
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4102);
                done();
            };
            var controller = new RoleController();
            controller.read(req, res);
        });
    });

    describe('#delete', function () {
        it('should delete current role data.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/role/read',
                    'res': {
                        'result': {
                            'affected': 1,
                            'data': [
                                {
                                    'name': 'Apache', 
                                    'revision': 11111
                                }
                            ]
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/role_history/create',
                    'res': { 
                        'result': {
                            'affected': 1
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/role/delete',
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
                'name': 'Apache',
            };
            var res = {};
            res.json = function (status, body) {
                body.should.eql({});
                done();
            };
            var controller = new RoleController();
            controller.delete(req, res);
        });
        it('should get error when parameter length beyond limit.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'ApacheApacheApacheApachApacheeApacheApaApacheApacheApachecheApache'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new RoleController();
            controller.delete(req, res);
        });
        it('should get error when something was wrong in subclass method invocation', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/role/read',
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
                'name': 'Apache'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4103);
                done();
            };
            var controller = new RoleController();
            controller.delete(req, res);
        });
    });

    describe('#history', function () {
        it('should get role history data.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/role_history/read',
                    'res': {
                        'result': {
                            'affected': 2,
                            'data': [
                                {
                                    'name': 'Apache', 
                                    'revision': 11111
                                },
                                {
                                    'name': 'Apache', 
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
                    'name': 'Apache'
                }
            };
            var res = {};
            res.json = function (status, body) {
                body.result.affected.should.equal(2);
                body.result.data[0].revision.should.equal(11111);
                body.result.data[1].revision.should.equal(11113);
                done();
            };
            var controller = new RoleController();
            controller.history(req, res);
        });
        it('should get error when bad parameter type.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'criteria': 'name == Apache'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new RoleController();
            controller.history(req, res);
        });
        it('should get error when parameter length beyond limit.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                "criteria": {
                    'name': 'Apache'
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
            var controller = new RoleController();
            controller.history(req, res);
        });
        it('should get error when something was wrong in subclass method invocation', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/role_history/read',
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
                    'name': 'Apache'
                }
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4104);
                done();
            };
            var controller = new RoleController();
            controller.history(req, res);
        });
    });
});

