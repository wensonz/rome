var libPath = process.env['JSCOV'] ? './lib-cov' : './lib',
    ConfigurationController = require(libPath + '/configuration-controller.js'),
    romeClient = require('rome-client'),
    should = require('should');

describe('configuration-controller', function () {
    'use strict';

    describe('#constructor', function () {
        it('should inherit methods from constructor.prototype.', function (done) {
            var controller = new ConfigurationController();
            controller.should.have.property('update');
            done();
        });
    });

    describe('#paramValidate_', function () {
        it('should pass parameter examination.', function (done) {
            var params = {
                "name": "Apache",
                "includes": ["IDC-zjm"]
            };
            var limits = {
                "name": {
                    "type": "string",
                    "limit": 8
                },
                "includes": {
                    "type": "object",
                    "limit": 2
                },
            };
            var controller = new ConfigurationController();
            var result = controller.paramValidate_(params, limits);
            should.not.exist(result);
            done();
        });
        it('should not pass parameter examination when string length beyond limit.', function (done) {
            var params = {
                "name": "WebServer-Apache",
                "includes": ["IDC-zjm"]
            };
            var limits = {
                "name": {
                    "type": "string",
                    "limit": 8
                },
                "includes": {
                    "type": "object",
                    "limit": 2
                },
            };
            var controller = new ConfigurationController();
            var result = controller.paramValidate_(params, limits);
            result.should.match(/^Post data too large/);
            done();
        });
        it('should not pass parameter examination when bad type.', function (done) {
            var params = {
                "name": "Apache",
                "includes": "IDC-zjm"
            };
            var limits = {
                "name": {
                    "type": "string",
                    "limit": 8
                },
                "includes": {
                    "type": "object",
                    "limit": 2
                },
            };
            var controller = new ConfigurationController();
            var result = controller.paramValidate_(params, limits);
            result.should.match(/^Bad record structure/);
            done();
        });
    });

    describe('#getCounter_', function () {
        it('should get global revision from counter.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/counter',
                    'res': { 
                        'result': {
                            'affected': 1,
                            'data': {
                                'name': 'revision',
                                'value': 12345
                            }
                        }
                    }
                },
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            var controller = new ConfigurationController();
            controller.getCounter_('revision', req, function (error, result) {
                result.should.equal(12345);
                done();
            });
        });
        it('should get error when failed to access vatican.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/counter',
                    'err': { 
                        'error': {
                            'code': 1001,
                            'message': "connect failed."
                        }
                    }
                },
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            var controller = new ConfigurationController();
            controller.getCounter_('revision', req, function (error, result) {
                should.not.exist(result);
                done();
            });
        });
    });

    describe('#update', function() {
        it('should successfully update role.', function (done) {
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
                    'action': '/vatican/configuration/roleHistory/create',
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
                'revision': 11111
            };
            var controller = new ConfigurationController();
            controller.update('role', 'roleHistory', req, function (error, result) {
                result.result.revision.should.equal(11115);
                done();
            });
        });
        it('should successfully create a new role.', function (done) {
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
                            'affected': 0,
                            'data': []
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/role/create',
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
                'name': 'Apache'
            };
            var controller = new ConfigurationController();
            controller.update('role', 'roleHistory', req, function (error, result) {
                result.result.revision.should.equal(11115);
                done();
            });
        });
        it('should get error when failed to CAS during create a new role.', function (done) {
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
                            'affected': 0,
                            'data': []
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/role/create',
                    'res': { 
                        'result': {
                            'affected': 1
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/role/cas',
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
            var controller = new ConfigurationController();
            controller.update('role', 'roleHistory', req, function (error, result) {
                should.not.exist(result);
                done();
            });
        });
        it('should get error when failed to read current role data from vatican.', function (done) {
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
                            'code': 1001,
                            'message': "connect failed."
                        }
                    }
                }
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Apache',
                'revision': 11111
            };
            var controller = new ConfigurationController();
            controller.update('role', 'roleHistory', req, function (error, result) {
                should.not.exist(result);
                done();
            });
        });
        it('should get error when failed to create a new role data.', function (done) {
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
                            'affected': 0,
                            'data': []
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/role/create',
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
                'name': 'Apache',
                'revision': 11111
            };
            var controller = new ConfigurationController();
            controller.update('role', 'roleHistory', req, function (error, result) {
                should.not.exist(result);
                done();
            });
        });
        it('should get error when failed to add role data to history collection.', function (done) {
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
                    'action': '/vatican/configuration/roleHistory/create',
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
                'name': 'Apache',
                'revision': 11111
            };
            var controller = new ConfigurationController();
            controller.update('role', 'roleHistory', req, function (error, result) {
                should.not.exist(result);
                done();
            });
        });
        it('should get error when vatican CAS failed.', function (done) {
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
                    'action': '/vatican/configuration/roleHistory/create',
                    'res': { 
                        'result': {
                            'affected': 1
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/role/cas',
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
                'name': 'Apache',
                'revision': 11111
            };
            var controller = new ConfigurationController();
            controller.update('role', 'roleHistory', req, function (error, result) {
                should.not.exist(result);
                done();
            });
        });
    });

    describe('#read', function() {
        it('should get role data from role collection.', function (done) {
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
                }
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                "criteria": {
                    'name': 'Apache'
                }
            };
            var controller = new ConfigurationController();
            controller.read('role', req, function (error, result) {
                result.result.data[0].revision.should.equal(11111);
                done();
            });

        });
        it('should get error when failed to read role data.', function (done) {
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
                "criteria": {
                    'name': 'Apache'
                }
            };
            var controller = new ConfigurationController();
            controller.read('role', req, function (error, result) {
                should.not.exist(result);
                done();
            });

        });
    });

    describe('#delete', function() {
        it('should delete role data.', function (done) {
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
                    'action': '/vatican/configuration/roleHistory/create',
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
                'name': 'Apache'
            };
            var controller = new ConfigurationController();
            controller.delete('role', 'roleHistory', req, function (error, result) {
                result.should.eql({});
                done();
            });

        });
        it('should get error when failed to get current role data.', function (done) {
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
            var controller = new ConfigurationController();
            controller.delete('role', 'roleHistory', req, function (error, result) {
                should.not.exist(result);
                done();
            });
        });
        it('should get error when role data can not be found.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/role/read',
                    'res': {
                        'result': {
                            'affected': 0,
                            "data": []
                        }
                    }
                }
            ];
            var req = {};
            req.call = romeClient(configurationOfRomeClient);
            req.body = {
                'name': 'Apache'
            };
            var controller = new ConfigurationController();
            controller.delete('role', 'roleHistory', req, function (error, result) {
                should.not.exist(result);
                done();
            });
        });
        it('should get error when failed to add role data to history.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/role/read',
                    'res': {
                        'result': {
                            'affected': 1,
                            "data": [
                                {
                                    "name": "Apache",
                                    "revision": 11111
                                }
                            ]
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/roleHistory/create',
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
            var controller = new ConfigurationController();
            controller.delete('role', 'roleHistory', req, function (error, result) {
                should.not.exist(result);
                done();
            });
        });
        it('should get error when failed to delete current role data.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/role/read',
                    'res': {
                        'result': {
                            'affected': 1,
                            "data": [
                                {
                                    "name": "Apache",
                                    "revision": 11111
                                }
                            ]
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/roleHistory/create',
                    'res': {
                        'result': {
                            'affected': 1
                        }
                    }
                },
                {
                    'action': '/vatican/configuration/role/delete',
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
            var controller = new ConfigurationController();
            controller.delete('role', 'roleHistory', req, function (error, result) {
                should.not.exist(result);
                done();
            });
        });
    });

    describe('#history', function() {
        it('should get role history data.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/roleHistory/read',
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
            var controller = new ConfigurationController();
            controller.history('roleHistory', req, function (error, result) {
                result.result.affected.should.equal(2);
                result.result.data[0].name.should.equal('Apache');
                result.result.data[1].revision.should.equal(11113);
                done();
            });

        });
        it('should get error when vatican access failed.', function (done) {
            var configurationOfRomeClient = [
                {
                    'action': '/vatican/configuration/roleHistory/read',
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
            var controller = new ConfigurationController();
            controller.history('roleHistory', req, function (error, result) {
                should.not.exist(result);
                done();
            });

        });
    });
});
