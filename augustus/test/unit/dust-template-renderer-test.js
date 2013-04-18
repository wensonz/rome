var libpath = process.env['JSCOV'] ? './lib-cov' : './lib',
    DustTemplateRenderer = require('./lib/renderers/dust-template-renderer.js')
                                .DustTemplateRenderer,
    dust = require('dust'),
    fs = require('fs'),
    assert = require('assert');

describe('#DustTemplateRenderer', function () {
    var renderer = null;

    beforeEach(function () {
        renderer = new DustTemplateRenderer([
            {
                name: 'test-template',
                content: '{author}'
            }
        ]);
    });
    afterEach(function () {
        renderer = new DustTemplateRenderer([
            {
                name: 'test-template',
                content: '{author}'
            }
        ]);
    });

    describe('init', function () {
        it('should compile and register correctly.', function () {
            assert(dust.cache.hasOwnProperty('test-template'));
        });
    });

    describe('render', function () {
        it('should return rendered content correctly', function () {
            renderer.render('test-template', {data: {author: 'real'}},
                    function (err, out) {
                assert('real' === out);
            });
        });

        it('should return error if any error exist.', function () {
            renderer.render('no-template', {author: 'real'},
                    function (err, out) {
                assert(err.message === 'Template Not Found: no-template');
            });
        });
    });
});
