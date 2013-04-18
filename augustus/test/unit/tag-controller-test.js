var libPath = process.env['JSCOV'] ? './lib-cov' : './lib',
    TagController = require(libPath + '/tag-controller.js'),
    romeClient = require('rome-client'),
    should = require('should');


describe('tag-controller', function() {
    'use strict';

    describe('#create', function () {
        it('should successfully create tag.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/tag/read',
                    'res': {
                        'result': {
                            'affected': 0,
                            'data': []
                        }
                    }
                },
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
                    'action': '/vatican/configuration/tag/create',
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
                'name': 'Apache-2.2.22-stable',
                'changelog': 'add a new tag'
            };
            var res = {};
            res.json = function (status, body) {
                body.result.revision.should.equal(11115);
                done();
            };
            var controller = new TagController();
            controller.create(req, res);
        });
        it('should successfully create tag by specific revision.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/tag/read',
                    'res': {
                        'result': {
                            'affected': 0,
                            'data': []
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/tag/create',
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
                'name': 'Apache-2.2.22-stable',
                "revision": 11111,
                'changelog': 'add a new tag'
            };
            var res = {};
            res.json = function (status, body) {
                body.result.revision.should.equal(11111);
                done();
            };
            var controller = new TagController();
            controller.create(req, res);
        });
        it('should get error when parameter length beyond limit.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Apache-2.2.22-stableApache-2.2.22-stableApache-2.2.22-stableApache-2.2.22-stable',
                'changelog': 'add a new tag'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new TagController();
            controller.create(req, res);
        });
        it('should get error when failed to read tag information from vatican.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/tag/read',
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
                'name': 'Apache-2.2.22-stable',
                'changelog': 'add a new tag'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4401);
                done();
            };
            var controller = new TagController();
            controller.create(req, res);
        });
        it('should get error when tag already exists.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/tag/read',
                    'res': {
                        'result': {
                            'affected': 1,
                            "data": [
                                {
                                    'name': 'Apache-2.2.22-stable',
                                    'revison': 11111
                                }
                            ]
                        }
                    }
                }
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Apache-2.2.22-stable',
                'changelog': 'add a new tag'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4401);
                done();
            };
            var controller = new TagController();
            controller.create(req, res);
        });
        it('should get error when vatican failed to create tag.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/tag/read',
                    'res': {
                        'result': {
                            'affected': 0,
                            'data': []
                        }
                    }
                },
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
                    'action': '/vatican/configuration/tag/create',
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
                'name': 'Apache-2.2.22-stable',
                'changelog': 'add a new tag'
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4401);
                done();
            };
            var controller = new TagController();
            controller.create(req, res);
        });
    });

    describe('#read', function () {
        it('should get current tag data.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/tag/read',
                    'res': {
                        'result': {
                            'affected': 1,
                            'data': [
                                {
                                    'name': 'Apache-2.2.22-stable', 
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
                    'name': 'Apache-2.2.22-stable'
                }
            };
            var res = {};
            res.json = function (status, body) {
                body.result.data[0].revision.should.equal(11111);
                done();
            };
            var controller = new TagController();
            controller.read(req, res);
        });
        it('should get error when bad parameter type.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                "criteria": 'name -eq Apache-2.2.22-stable',
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4001);
                done();
            };
            var controller = new TagController();
            controller.read(req, res);
        });
        it('should get error when parameter length beyond limit.', function (done) {
            var configurationOfRomeClient = [];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                "criteria": {
                    'name': 'Apache-2.2.22-stable'
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
            var controller = new TagController();
            controller.read(req, res);
        });
        it('should get error when something was wrong in subclass method invocation', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/tag/read',
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
                    'name': 'Apache-2.2.22-stable'
                }
            };
            var res = {};
            res.json = function (status, body) {
                body.error.code.should.equal(4402);
                done();
            };
            var controller = new TagController();
            controller.read(req, res);
        });
    });
});

