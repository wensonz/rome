var util = require('util'),
    fs = require('fs'),
    log4js = require('log4js'),
    path = require('path'),
    crypto = require('crypto'),
    async = require('async'),
    ConfigurationWriter = require('./configuration-writer.js');

function ConfigurationLocalFileWriter(chroot) {
    "use strict";
    var self = this,
        stat = null;

    /**
     * The prefix of file path
     *
     * @property chroot_
     * @type string
     */
    this.chroot_ = chroot;

    /**
     * logger
     *
     * @property logger_
     * @type logger
     */
    this.logger_ = log4js.getLogger('ConfigurationLocalFileWriter');

    try {
        stat = fs.statSync(chroot);
        if (!stat.isDirectory()) {
            throw new Error();
        }
    } catch (e) {
        self.logger_.error('chroot should be a directory.');
        throw new Error('chroot should be a directory.');
    }
}

util.inherits(ConfigurationLocalFileWriter, ConfigurationWriter);

ConfigurationLocalFileWriter.prototype.write = function (content, filePath, callback) {
    "use strict";
    var self = this,
        dir = path.dirname(this.chroot_ + filePath),
        absPath = this.chroot_ + filePath;

    async.waterfall([
        function (done) {
            fs.stat(dir, function (err, stat) {
                if (err) {
                    fs.mkdir(dir, function (err) {
                        if (err) {
                            self.logger_.error('Can not create directory ' + dir);
                        }
                        done(err);
                    });                                                 
                    return;
                }
                if (!stat.isDirectory()) {
                    fs.unlink(dir, function (err) {
                        if (err) {
                            self.logger_.error('Can not create directory ' + dir);
                            done(err);
                            return;
                        }
                        fs.mkdir(dir, function (err) {
                            if (err) {
                                self.logger_.error('Can not create directory ' + dir);
                            }
                            done(err);
                        });                                                 
                    });
                    return;
                }
                done();
            });                                           
        },
        function (done) {
            fs.writeFile(absPath, content, function (err) {
                if (err) {
                    self.logger_.error('Can not save file ' + absPath + ' ' + err);
                    done(err);
                    return;
                }
                self.logger_.debug('Save file successfully. ' + absPath);
                done();
            });
        },
        function (done) {
            var md5sum = crypto.createHash('md5'),
                md5Path = absPath + '.md5',
                s = fs.ReadStream(absPath);
            s.on('data', function(d) { md5sum.update(d); });
            s.on('end', function() {
                var md5 = md5sum.digest('hex');
                fs.writeFile(md5Path, md5, function (err) {
                    if (err) {
                        self.logger_.error('Can not save file ' + md5Path + ' ' + err);
                        done(err);
                        return;
                    }
                    self.logger_.debug('Save file successfully. ' + md5Path);
                    done();
                });
            });
        }
    ], function (err) {
        callback(err);
    });
};

module.exports.ConfigurationLocalFileWriter = ConfigurationLocalFileWriter;

// vim:sw=4:ts=4:sts=4:et:ai: 
