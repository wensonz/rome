/**
 * This module contains the implementation of the file management APIs
 * 
 * @module caligula.components.file.base
 */
Condotti.add('caligula.components.file.base', function (C) {

    /**
     * This FileHandler is a child class of Handler, and is designed to provide
     * file management APIs.
     *
     * @class FileHandler
     * @constructor
     * @extends Handler
     * @param {Object} config the config object for this file handler
     */
    function FileHandler (config) {
        /* inheritance */
        this.super();

        /**
         * The config object for this handler
         *
         * @property config_
         * @type Object
         */
        this.config_ = config || {};

        /**
         * The root path to keep the uploaded files
         * 
         * @property root_
         * @type String
         */
        this.root_ = this.config_.root || '/data1/rome/files/';
    }

    /**
     * Upload a file with md5
     *
     * @method upload
     * @param {Action} action the upload action to be handled
     */
    FileHandler.prototype.upload = function (action) {
        var params = action.data,
            self = this,
            logger = C.logging.getStepLogger(this.logger_),
            file = null;

        C.async.waterfall([
            function (next) { // Query the existing file with the specified name
                logger.start('Querying the existing files with name ' + 
                             params.name);
                action.data = { criteria: { name: params.name }};
                action.acquire('data.file.read', next);
            },
            function (result, unused, next) { // Copy saved temp file 
                logger.done(result);

                logger.start('Checking if the specified name ' + params.name + 
                             ' already exist');
                if (result.affected > 0) {
                    next(new C.caligula.errors.FileAlreadyExistError(
                         'Specified file name ' + params.name + ' already exist'
                    ));
                    return;
                }

                logger.done();

                file = action.files[params.name];
                if (!file) {
                    // next(new C.caligula)
                }
                logger.start('Copying the saved temparory file ' + file.);
            }

        ], function (error, result) {
            //
        });
    };

}, '0.0.1', { requires: [] });
