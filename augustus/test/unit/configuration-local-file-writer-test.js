var libpath = process.env.JSCOV ? './lib-cov' : './lib',
    fs = require('fs'),
    async = require('async'),
    Writer = require('./lib/writers/configuration-local-file-writer.js')
                .ConfigurationLocalFileWriter,
    crypto = require('crypto'),
    assert = require('assert');
    
describe('ConfigurationLocalFileWriter', function() {
    "use strict";
    var writer;

    beforeEach(function () {
        writer = new Writer('/tmp');
    });
    afterEach(function (callback) {
        writer = null;
        async.series([
            function (done) {
                fs.unlink('/tmp/node/test.md5', function (err) {
                    done(err);
                });
            },
            function (done) {
                fs.unlink('/tmp/node/test', function (err) {
                    done(err);
                });
            },
            function (done) {
                fs.rmdir('/tmp/node', function (err) {
                    done(err);
                });
            }
        ], function (err) {
            callback();
        });
    });

    describe('init', function () {
        it('should check weather the CHROOT is exist', function () {
            var writer;
            try {
                writer = new Writer(__filename);
            } catch (e) {
                assert('chroot should be a directory.' === e.message);
            }

            try {
                writer = new Writer('/tmp/null');
            } catch (e) {
                assert('chroot should be a directory.' === e.message);
            }
        });
    });

    describe('wirter', function () {
        it('should save file correctly', function (done) {
            writer.write('test', '/node/test', function (err) {
                assert('test' === fs.readFileSync('/tmp/node/test').toString());
                assert(crypto.createHash('md5').
                    update(new Buffer('test')).digest('hex')
                        === fs.readFileSync('/tmp/node/test.md5').toString());
                done();
            });
        });

        it('should save file correcotly, if the node dir file isn\'t a directory.',
                function (done) {
            fs.writeFileSync('/tmp/node', '');
            writer.write('test', '/node/test', function (err) {
                assert('test' === fs.readFileSync('/tmp/node/test').toString());
                assert(crypto.createHash('md5').
                    update(new Buffer('test')).digest('hex')
                        === fs.readFileSync('/tmp/node/test.md5').toString());
                done();
            });
        });

        it('should return error, if can\'t create node directory', function (done) {
            var mockMkdir = fs.mkdir;
            fs.mkdir = function (d, callback) {
                callback(new Error('mkdir'));
            };
            writer.write('test', '/node/test', function (err) {
                assert('mkdir' === err.message);
                fs.mkdir = mockMkdir;
                done();
            });

        });

        it('should return error, if node exist but not a directory ' +
                'and can\'t create node directory', function (done) {
            var mockMkdir = fs.mkdir;
            fs.mkdir = function (d, callback) {
                callback(new Error('mkdir'));
            };

            fs.writeFileSync('/tmp/node', '');
            writer.write('test', '/node/test', function (err) {
                assert('mkdir' === err.message);
                fs.mkdir = mockMkdir;
                done();
            });
        });

        it('should return error, if can\'t unlink the node "file"', function (done) {
            var mockUnlink = fs.unlink;
            fs.unlink = function (p, callback) {
                callback(new Error('unlink'));
            };
            fs.writeFileSync('/tmp/node', '');
            writer.write('test', '/node/test', function (err) {
                assert('unlink' === err.message);
                fs.unlink = mockUnlink;
                done();
            });
        });

        it('should return error, if can\'t write file', function (done) {
            var mockWriteFile = fs.writeFile;
            fs.writeFile = function (p, d, callback) {
                callback(new Error('writeFile'));
            };

            writer.write('test', '/node/test', function (err) {
                assert('writeFile' === err.message);
                fs.writeFile = mockWriteFile;
                done();
            });
        });
    });
});
