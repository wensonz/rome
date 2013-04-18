var util = require('util'),
    async = require('async'),
    log4js = require('log4js'),
    compares = require('../compare'),
    constants = require('../constants'),
    processor = require('./configuration-processor');

/**
 * @class FilesConfigurationProcessor
 * @extends ConfigurationProcessor
 */
function FilesConfigurationProcessor(renderer, formatter, writer) {
    'use strict';
    processor.ConfigurationProcessor.call(this);
    this.logger_ = log4js.getLogger('FilesConfigurationProcessor');
    this.renderer_ = renderer;
    this.formatter_ = formatter;
    this.writer_ = writer;
}
util.inherits(FilesConfigurationProcessor, processor.ConfigurationProcessor);

/**
 * check merger records 
 * @method compareFile
 * @param {Object} mergeFiles merge role and node records 
 * @param {function} callback the callback function to be invoked when error occures
 */
FilesConfigurationProcessor.prototype.compareConfigurationContent = function (file, callback) {
    'use strict';
    var self = this,
        name = null,
        err = null,
        params = null,
        compare = null,
        validator = null;

    compare = new compares.Compare();
    params = {
        'name': {
            'type': 'string',
            'limit': null
        },
        'path': {
            'type': 'string',
            'limit': null
        },
        'owner': {
            'type': 'string',
            'limit': null
        },
        'permission': {
            'type': 'string',
            'limit': null
        },
        'template': {
            'type': 'string',
            'limit': null
        }
    };

    validator = compare.paramValidate_(file, params);
    if (validator !== null) {
        self.logger_.error(validator);
        err = {
            'httpCode': 415,
            'code': constants.error.processer.files.compareContentError,
            'message': 'Configuration file: ' + file.name + ' | ' + 
                       validator
        };
        callback(err);
        return;
    }
    callback(null);
};

/**
 * @method process
 * @param {Object} files the mapping from file names to file objects that is
 *                       to be processed
 * @param {Function} callback the callback to be invoked after the processing
 *                            or when error occurs
 */
FilesConfigurationProcessor.prototype.process = function (fileOption, file,
    properties, callback) {
        'use strict';
        var self = this,
            err = null,
            files = {},
            allData = {},
            path = null,
            httpUrl = null,
            content = null;
 
        allData.data = file.data;
        allData.properties = properties;
        self.renderer_.render(file.template, allData, function (error, data) {
            if (error) {
                err = {
                    'httpCode': 415,
                    'code': constants.error.renderer.files.configFileError,
                    'message': 'Should be render ' + file.template + ' error.'
                };
                self.logger_.error(err.message + ' Result: ' + 
                                   util.inspect(error, false, null));
                callback(err);
                return;
            }    
            Object.keys(file).forEach(function (f) {
                if ('template' !== f && 'data' !== f) {
                    files[f] = file[f];
                }
            });

            files.content = new Buffer(data).toString('base64');
            self.formatter_.format(files, function (error, content) {
                if (error) {
                    err = {
                        'httpCode': 415,
                        'code': constants.error.formatter.jsonError,
                        'message': 'Should be format ' + files.name +
                                   ' configure file error.'
                    };
                    self.logger_.error(err.message + ' Result: ' + 
                                       util.inspect(error, false, null));
                    callback(err);
                    return;
                }    
                path = fileOption.fileUrl + files.name + '_' + fileOption.revision;
                self.writer_.write(content, path, function (error) {
                    if (error) {
                        err = {
                            'httpCode': 415,
                            'code': constants.error.writer.files.configFileError,
                            'message': 'Should be save ' + files.name +
                                       ' config error in sever.'
                        };
                        self.logger_.error(err.message + ' Result: ' +
                                           util.inspect(error, false, null));
                        callback(err);
                        return;
                    }
                    httpUrl = fileOption.urlPrefix + path; 
                    callback(null, file.name, httpUrl);
                });
            });
        });
};

module.exports.FilesConfigurationProcessor = FilesConfigurationProcessor;
