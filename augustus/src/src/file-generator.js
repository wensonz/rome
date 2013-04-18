var async = require('async'),
    fs = require('fs'),
    log4js = require('log4js'),
    dust = require('dust'),
    conf = require('./config.json').fileGenerator;
/**
 * Generate file content and save file on disk.
 *
 * @class FileGenerator
 * @constructor
 *
 */
function FileGenerator(templates) {
    "use strict";
    /**
     * logger
     *
     * @property logger_
     * @type object
     */
    this.logger = log4js.getLogger('FileGenerator');

    // dust.compile() can registe compiled template into "dust", we can use the
    // template through template name later.
    templates.forEach(function (t) {
        eval(dust.compile(t.content, t.name));
    });
}

/**
 * generate file content
 * @method render
 * @return {Object} contain hash from file name to file content
 */
FileGenerator.prototype.render = function (targetFiles, data, callback) {
    "use strict";
    var self = this,
        filesContent = [];

    async.forEach(data.configuration.files, function (f, done) {
        var i = null,
            content = {};
        if (targetFiles.indexOf(f.name) < 0) {
            done();
            return;
        }

        // copy meta data
        Object.keys(f).forEach(function (i) {
            if ('template' !== i && 'content' !== i) {
                content[i] = f[i];
            }
        });
        dust.render(f.template, f.content, function (err, out) {
            if (err) {
                done(err);
                return;
            }
            content.content = out;
            filesContent.push(content);
            done();
        });
    }, function (err) {
        if (err) {
            callback(err, null);
        }
        callback(null, filesContent);
    });
};

/**
 * save file to disk.
 * @method save
 * @return {Object} contain hash from file name to file path.
 */
FileGenerator.prototype.save = function (nodeName, targetFiles, filesContent, callback) {
    "use strict";
    var self = this,
        filesUrl = {},
        timestamp = Math.round(new Date().getTime() / 1000),
        filePath = conf.fsPrefix + '/' + nodeName + '/',
        stat = null;

    try {
        stat = fs.statSync(filePath);
        if (!stat.isDirectory()) {
            this.logger.error('No such directory ' + filePath);
            throw new Error('No such directory');
        }
    } catch (e) {
        fs.mkdirSync(filePath);
    }

    async.forEach(filesContent, function (f, done) {
        if (targetFiles.indexOf(f.name) < 0) {
            done();
            return;
        }
        f.content = new Buffer(f.content).toString("base64");
        fs.writeFile(filePath + f.name + '_' + timestamp, JSON.stringify(f), function (err) {
            if (err) {
                done(err);
                return;
            }
            filesUrl[f.name] = conf.urlPrefix + '/' + nodeName + '/' +
                               f.name + '_' + timestamp;
            done();
        });
    }, function (err) {
        if (err) {
            callback(err, null);
        }
        callback(null, filesUrl);
    });
};

module.exports = FileGenerator;
