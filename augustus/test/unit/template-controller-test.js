var libPath = process.env['JSCOV'] ? './lib-cov' : './lib',
    TemplateController = require(libPath + '/template-controller.js'),
    romeClient = require('rome-client'),
    should = require('should');


describe('template-controller', function() {
    'use strict';

    describe('#update', function () {
        it('should successfully update template data.', function (done) {
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
                    'action': '/vatican/configuration/template/read',
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
                {
                    'action': '/vatican/configuration/template_history/create',
                    'res': { 
                        'result': {
                            'affected': 1
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/template/cas',
                    'res': { 
                        'result': {
                            'affected': 1,
                            'data': [
                                {
                                    'name': 'ApacheConfTpl', 
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
                'name': 'ApacheConfTpl',
                'revision': 11111,
                'content': "<VirtualHost *:80>\nServerName {ServerName}\n</VirtualHost>",
                'changelog': 'add new data'
            };
            var res = {};
            res.json = function (status, body) {
                body.result.revision.should.equal(11115);
                done();
            };
            var controller = new TemplateController();
            controller.update(req, res);
        });
        it('should get error when parameter length beyond limit.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'ApacheConfTplApacheConfTplApacheConfTplApacheConfTplApacheConfTplApacheConfTpl',
                'revision': 11111,
                'content': "<VirtualHost *:80>\nServerName {ServerName}\n</VirtualHost>",
                'changelog': 'add new data'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new TemplateController();
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
                    'action': '/vatican/configuration/template/read',
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
                'name': 'ApacheConfTpl',
                'revision': 11111,
                'content': "<VirtualHost *:80>\nServerName {ServerName}\n</VirtualHost>",
                'changelog': 'add new data'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4201);
                done();
            };
            var controller = new TemplateController();
            controller.update(req, res);
        });
    });

    describe('#read', function () {
        it('should get current template data.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/template/read',
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
                "criteria": {
                    'name': 'ApacheConfTpl'
                }
            };
            var res = {};
            res.json = function (status, body) {
                body.result.data[0].revision.should.equal(11111);
                done();
            };
            var controller = new TemplateController();
            controller.read(req, res);
        });
        it('should get error when parameter length beyond limit.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'ApacheConfTplApacheConfTplApacheConfTplApacheConfTplApacheConfTplApacheConfTpl'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new TemplateController();
            controller.read(req, res);
        });
        it('should get error when something was wrong in subclass method invocation', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/template/read',
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
                    'name': 'ApacheConfTpl'
                }
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4202);
                done();
            };
            var controller = new TemplateController();
            controller.read(req, res);
        });
    });

    describe('#delete', function () {
        it('should delete current template data.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/template/read',
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
                {
                    'action': '/vatican/configuration/template_history/create',
                    'res': { 
                        'result': {
                            'affected': 1
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/template/delete',
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
                'name': 'ApacheConfTpl',
            };
            var res = {};
            res.json = function (status, body) {
                body.should.eql({});
                done();
            };
            var controller = new TemplateController();
            controller.delete(req, res);
        });
        it('should get error when parameter length beyond limit.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'ApacheConfTplApacheConfTplApacheConfTplApacheConfTplApacheConfTplApacheConfTpl'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new TemplateController();
            controller.delete(req, res);
        });
        it('should get error when something was wrong in subclass method invocation', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/template/read',
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
                'name': 'ApacheConfTpl'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4203);
                done();
            };
            var controller = new TemplateController();
            controller.delete(req, res);
        });
    });

    describe('#history', function () {
        it('should get template history data.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/template_history/read',
                    'res': {
                        'result': {
                            'affected': 2,
                            'data': [
                                {
                                    'name': 'ApacheConfTpl', 
                                    'revision': 11111
                                },
                                {
                                    'name': 'ApacheConfTpl', 
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
                    'name': 'ApacheConfTpl'
                }
            };
            var res = {};
            res.json = function (status, body) {
                body.result.affected.should.equal(2);
                body.result.data[0].revision.should.equal(11111);
                body.result.data[1].revision.should.equal(11113);
                done();
            };
            var controller = new TemplateController();
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
            var controller = new TemplateController();
            controller.history(req, res);
        });
        it('should get error when parameter length beyond limit.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                "criteria": {
                    'name': 'ApacheConfTpl'
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
            var controller = new TemplateController();
            controller.history(req, res);
        });
        it('should get error when something was wrong in subclass method invocation', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/template_history/read',
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
                    'name': 'ApacheConfTpl'
                }
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4204);
                done();
            };
            var controller = new TemplateController();
            controller.history(req, res);
        });
    });
});

