var libpath = process.env['JSCOV'] ? './lib-cov' : './lib',
    RoleConfigurationResolver = require(libpath + '/role-configuration-resolver.js').RoleConfigurationResolver,
    assert = require('assert');

describe('#RoleConfigurationResolver', function () {
    var resolver = null;

    beforeEach(function () {
        resolver = new RoleConfigurationResolver();
        resolver.logger_ = {
            info: function () {},
            debug: function () {},
            warn: function () {},
            error: function () {}
        };
    });
    afterEach(function () {
        resolver = null;
    });

    describe('#resolve', function () {
        it('should return empty object if node.includes is invliad', function () {
            var node = {includes: null};
            assert.deepEqual({}, resolver.resolve(node, null));

            node.includes = 0;
            assert.deepEqual({}, resolver.resolve(node, null));
        });

        it('should return correctly', function () {
            resolver.calculate_ = function () {
                return [{role: 'role'}];
            };
            resolver.resolveRole_ = function (r, c, s) {
                s.test = "test";
            }

            assert.deepEqual(resolver.resolve({includes: "xxx"}, {}),
                {configuration: { test: 'test'}, includes: ['role']});
        });
    });

    describe('#resolveRole_', function () {
        it('should return change paras correctly.', function () {
            var configuration = {
                    'packages': {
                        'httpd': {
                            'name': 'httpd-2.2-6.rpm'
                        }
                    }
                },
                schema = {};

            resolver.resolveRole_({
                'name': 'apache',
                'configuration': {
                    'packages': {
                        'httpd': {
                            'name': 'httpd-2.2-2.rpm'
                        }
                    }
                }
            }, 1, configuration, 2);
            assert.deepEqual(configuration, {packages:
                {httpd: {name: 'httpd-2.2-2.rpm'}}
            });
        });
    });

    describe('#calculate_', function () {
        it('should calculate include correctly', function () {
            var node = {
                'name': 'test',
                'includes': ['weibo-qa']
            };
            var roles = {
                'apache': {
                    'name': 'apache'
                },
                'apache2': {
                    'name': 'apache2'
                },
                'weibo2': {
                    'name': 'weibo2',
                    'includes': ['apache2']
                },
                'weibo': {
                    'name': 'weibo',
                    'includes': ['apache']
                },
                'weibo-qa': {
                    'name': 'weibo-qa',
                    'includes': ['weibo', 'weibo2']
                }
            };
            assert.deepEqual(resolver.calculate_(node, roles),
                [
                    { role: 'apache', level: 3 },
                    { role: 'apache2', level: 3 },
                    { role: 'weibo', level: 2 },
                    { role: 'weibo2', level: 2 },
                    { role: 'weibo-qa', level: 1 }
                ]);

            try {
                resolver.calculate_(node, {});
            } catch (e) {
                assert('RoleNotFoundError' === e.name);
            }
        });
    });
});
