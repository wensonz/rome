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
        this.config_ = config; // Can not be empty, null or undefined
        
        /**
         * The directory to keep the uploaded files
         * 
         * @property directory_
         * @type String
         */
        this.directory_ = this.config_.directory || '/data1/rome/files/';
        
        /**
         * The base url to construct the url for downloading files
         * via HTTP protocol
         *
         * @property baseUrl_
         * @type String
         */
        this.baseUrl_ = this.config_.baseUrl;
        
        /* initialize */
        if (this.baseUrl_[this.baseUrl_.length - 1] !== '/') {
            this.baseUrl_ += '/'; // Add the trailing '/'
        }
    }
    
    C.lang.inherit(FileHandler, C.caligula.handlers.Handler);

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
            file = null,
            owner = null;

        C.async.waterfall([
            function (next) { // Lock the file to be created
                logger.start('Acquiring the lock for file ' + params.name);
                self.lock_(action, next);
            },
            function (result, next) { // Query the existing file with the specified name
                logger.done(result);
                owner = result;
                
                logger.start('Querying the existing files with name ' + 
                             params.name);
                action.data = { criteria: { name: params.name }};
                action.acquire('data.file.read', next);
            },
            function (result, unused, next) { // Copy saved temp file 
                var rs = null,
                    ws = null;
                
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
                
                logger.start('Validate the uploaded file ' + 
                             C.lang.reflect.inspect(action.file));
                             
                if (!action.file) {
                    next(new C.caligula.errors.InvalidArgumentError(
                        'A file is supposed to be uploaded via this API, but ' +
                        'it can not be found'
                    ));
                    return;
                }
                
                file = action.file;
                logger.done(file);
                
                logger.start('Comparing the md5 of the uploaded file ' + 
                             file.path);
                if (params.md5 !== file.hash) {
                    next(new C.caligula.errors.UploadedFileCorruptedError(
                        'MD5 of the uploaded file ' + params.name + ' is ' +
                        file.hash + ' which does not match the one provided ' +
                        'in the params: ' + params.md5
                    ));
                    return;
                }
                logger.done();
                
                logger.start('Copying the saved temparory file ' + file.path +
                             ' to ' + 
                             C.natives.path.resolve(self.directory_, params.name));
                
                try {
                    rs = C.natives.fs.createReadStream(file.path);
                    ws = C.natives.fs.createWriteStream(
                        C.natives.path.resolve(self.directory_, params.name)
                    );
                    
                    rs.on('error', next);
                    ws.on('error', next);
                    ws.on('close', next);
                    
                    rs.pipe(ws);
                } catch (e) {
                    next(new C.caligula.errors.InternalServerError(
                        e.toString()
                    ));
                    return;
                }
            },
            function (next) { // Create file object
                logger.done();
                
                action.data = params;
                action.data.locations = [self.baseUrl_];
                logger.start('Creating file record with params: ' +
                             C.lang.reflect.inspect(action.data));
                
                action.acquire('data.file.create', next);
            }
        ], function (error, result) {
            var cleanup = function () {
                if (error) {
                    logger.error(error);
                    action.error(error);
                    return;
                }

                logger.done(result);
                action.done();
            };
            
            if (owner) {
                self.logger_.debug('Release the pre-acquired lock ' +
                                   'for file ' + params.name + ' ...');
                self.unlock_(action, owner, cleanup);
                return;
            }
            
            cleanup();
        });
    };
    
    /**
     * Download the required file
     *
     * @method download
     * @param {Action} action the downloading action to be handled
     */
    FileHandler.prototype.download = function (action) {
        var params = action.data,
            logger = C.logging.getStepLogger(this.logger_),
            file = null;
        
        if (!params.dryrun) { // temparory check
            action.error(new C.caligula.errors.NotImplementedError(
                'Now only dryrun is supported by this API'
            ));
            return;
        }
        
        C.async.waterfall([
            function (next) { // Read the file record
                logger.start('Reading the file object with name ' + 
                             params.name);
                action.data = { criteria: { name: params.name }};
                action.acquire('data.file.read', next);
            },
            function (result, unused, next) {
                var url = null;
                
                logger.done(result);
                
                logger.start('Ensuring the required file ' + params.name + 
                             ' exist');
                             
                if (0 === result.affected) {
                    next(new C.caligula.errors.FileNotFoundError(
                        'Required file ' + params.name + ' can not be found'
                    ));
                    return;
                }
                
                logger.done();
                
                file = result.data[0];
                
                logger.start('Generating the download url for file ' + 
                             params.name);
                
                url = file.locations[0] + params.name;
                next(null, url);
            }
        ], function (error, result) {
            if (error) {
                logger.error(error);
                action.error(error);
                return;
            }
            
            logger.done(result);
            action.done({ url: result, md5: file.md5 });
        });
    };
    
    /**********************************************************************
     *                                                                    *
     *                        PRIVATE MEMBERS                             *
     *                                                                    *
     **********************************************************************/
    
    /**
     * Lock the file to be created
     *
     * @method lock_
     * @param {Action} action the action which causes this collection lock
     * @param {Function} callback the callback function to be invoked after the
     *                            lock has been acquired successfully, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error, id) {}'
     */
    FileHandler.prototype.lock_ = function(action, callback) {
        var params = action.data,
            logger = C.logging.getStepLogger(this.logger_);
        
        logger.start('Calling lock.acquire on "file.' + params.name + '"');
        
        action.data = { 
            name: 'file.' + params.name,
            lease: 5000 // max lifespan for a lock
        }; 
        
        action.acquire('lock.acquire', function (error, result) {
            action.data = params;
            
            if (error) {
                logger.error(error);
                callback(error, null);
                return;
            }
            
            logger.done(result);
            callback(null, result);
        });
    };
    
    /**
     * Unlock the pre-acquired file lock
     *
     * @method unlock_
     * @param {Action} action the action which requires this lock
     * @param {String} id the owner id of the lock currently hold
     * @param {Function} callback the callback function to be invoked after the
     *                            lock has been acquired successfully, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error) {}'
     */
    FileHandler.prototype.unlock_ = function(action, id, callback) {
        var params = action.data,
            logger = C.logging.getStepLogger(this.logger_);
        
        logger.start('Calling lock.release on "file.' + params.name + '"');
        
        action.data = { name: 'file.' + params.name, owner: id };
        action.acquire('lock.release', function (error) {
            action.data = params;
            
            if (error) {
                logger.error(error);
                // callback(error, null);
                callback(); // It's safe not to report errors in unlock
                return;
            }
            
            logger.done();
            callback();
        });
    };
    
    C.namespace('caligula.handlers').FileHandler = FileHandler;
    
    /**
     * This type of error is desgiend to be thrown when the required file can
     * not be found.
     * 
     * @class FileNotFoundError
     * @constructor
     * @extends NotFoundError
     * @param {String} message the error message
     */
    function FileNotFoundError (message) {
        /* inheritance */
        this.super(4, message);
    }
    C.lang.inherit(FileNotFoundError, C.caligula.errors.NotFoundError);
    C.namespace('caligula.errors').FileNotFoundError = FileNotFoundError;
    
    
    /**
     * This type of error is desgiend to be thrown when the md5 sum of the
     * uploaded file does not match with the provided one in params.
     * 
     * @class UploadedFileCorruptedError
     * @constructor
     * @extends PreconditionFailedError
     * @param {String} message the error message
     */
    function UploadedFileCorruptedError (message) {
        /* inheritance */
        this.super(1, message);
    }
    C.lang.inherit(UploadedFileCorruptedError, C.caligula.errors.PreconditionFailedError);
    C.namespace('caligula.errors').UploadedFileCorruptedError = UploadedFileCorruptedError;

    
    /**
     * This type of error is desgiend to be thrown when file uploaded already 
     * exists
     * 
     * @class FileAlreadyExistError
     * @constructor
     * @extends ConflictError
     * @param {String} message the error message
     */
    function FileAlreadyExistError (message) {
        /* inheritance */
        this.super(3, message);
    }
    C.lang.inherit(FileAlreadyExistError, C.caligula.errors.ConflictError);
    C.namespace('caligula.errors').FileAlreadyExistError = FileAlreadyExistError;

}, '0.0.1', { requires: ['caligula.handlers.base'] });
