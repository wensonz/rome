/**
 * This module contains the implementation of the package management APIs.
 *
 * @module caligula.components.package.base
 */
Condotti.add('caligula.components.package.base', function (C) {
    
    /**
     * This PackageHandler is a child class of Handler, and designed to provide
     * package management functionalities via HTTP API
     *
     * @class PackageHandler
     * @constructor
     * @extends Handler
     * @param {Object} config the config object for this package handler
     */
    function PackageHandler (config) {
        /* inheritance */
        this.super();
        
        /**
         * The config object for this handler
         *
         * @property config_
         * @type Object
         */
        this.config_ = config || {}; // Can not be empty, null or undefined
        
        /**
         * The directory to keep the uploaded files
         * 
         * @property directory_
         * @type String
         */
        this.directory_ = this.config_.directory || '/data1/rome/packages/';
        
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
    
    C.lang.inherit(PackageHandler, C.caligula.handlers.Handler);
    
    /**
     * Release a new package
     *
     * @method release
     * @param {Action} action the releasing action to be handled
     */
    PackageHandler.prototype.release = function (action) {
        var params = action.data,
            self = this,
            logger = C.logging.getStepLogger(this.logger_),
            owner = null;
        
        C.async.waterfall([
            function (next) { // Lock the package
                logger.start('Acquiring the lock for package ' + params.name);
                self.lock_(action, next);
            },
            function (result, next) {
                logger.done(result);
                owner = result;
                
                logger.start('Searching the existing packages with name ' +
                             params.name);
                action.data = { criteria: { 
                    name: params.name, version: params.version 
                }};
                action.acquire('data.package.read', next);
            },
            function (result, unused, next) {
                var name = null,
                    ws = null,
                    rs = null,
                    file = null,
                    path = null;
                
                logger.done(result);
                
                logger.start('Ensuring the package ' + params.name + '@' +
                             params.version + ' not exist');
                if (result.affected > 0) {
                    next(new C.caligula.errors.PackageAlreadyExistError(
                        'Package to be released ' + params.name + '@' +
                        params.version + ' already exists'
                    ));
                    return;
                }
                logger.done();
                // Save the package file directly instead of utilizing the
                // file management API in order to place the package into the
                // RPM repository directory
                logger.start('Validate the uploaded package file ' + 
                             C.lang.reflect.inspect(action.file));
                             
                if (!action.file) {
                    next(new C.caligula.errors.InvalidArgumentError(
                        'A package file is supposed to be uploaded via this ' +
                        'API, but it can not be found'
                    ));
                    return;
                }
                
                file = action.file;
                logger.done(file);
                
                logger.start('Comparing the md5 of the uploaded package ' + 
                             file.path);
                if (params.md5 !== file.hash) {
                    next(new C.caligula.errors.UploadedFileCorruptedError(
                        'MD5 of the uploaded package ' + params.name + ' is ' +
                        file.hash + ' which does not match the one provided ' +
                        'in the params: ' + params.md5
                    ));
                    return;
                }
                logger.done();
                
                name = params.name + '-' + params.version + '.x86_64.rpm';
                path = C.natives.path.resolve(self.directory_, name);
                logger.start('Copying the temparorily saved package file ' + 
                             file.path + ' to ' + path);
                
                try {
                    rs = C.natives.fs.createReadStream(file.path);
                    ws = C.natives.fs.createWriteStream(path);
                    
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
                /*
                name = params.name + '-' + params.version + '.rpm';
                logger.start('Uploading the package file ' + name + 
                             ' with md5: ' + params.md5);
                             
                action.data = { name: name, md5: params.md5 };
                action.acquire('file.upload', next);
                */
            },
            function (next) {
                logger.done();

                logger.start('Running createrepo in ' + self.directory_ + 
                             ' to update the YUM repository');
                C.natives.child_process.exec(
                    'createrepo --update "' + self.directory_ + '"', 
                    next
                );
            },
            function (stdout, stderr, next) {
                logger.done(stdout.toString() + '\n' + stderr.toString());
                
                action.data = params;
                action.data.locations = [self.baseUrl_];
                
                logger.start('Creating package object with params: ' +
                             C.lang.reflect.inspect(action.data));
                action.acquire('data.package.create', next);
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
                action.data = params;
                self.logger_.debug('Release the pre-acquired lock ' +
                                   'for package ' + params.name + '@' + 
                                   params.version + ' ...');
                self.unlock_(action, owner, cleanup);
                return;
            }
            
            cleanup();
        });
    };
    
    /**
     * Read the package object satisfied the criteria
     *
     * @method read
     * @param {Action} action the querying action to be handled
     */
    PackageHandler.prototype.read = function (action) {
        action.acquire('data.package.read', function (error, result) {
            if (error) {
                action.error(error);
                return;
            }
            action.done(result);
        });
    };
    
    /**
     * Fetch the specified package
     *
     * @method fetch
     * @param {Action} action the fetching action to be handled
     */
    PackageHandler.prototype.fetch = function (action) {
        var params = action.data,
            logger = C.logging.getStepLogger(this.logger_);
            
        if (!params.dryrun) {
            action.error(new C.caligula.errors.NotImplementedError(
                'Now only dryrun is supported by this API'
            ));
            return;
        }
        
        C.async.waterfall([
            function (next) { // Read the package object
                logger.start('Reading the required package ' + params.name +
                             '@' + params.version);
                action.data = { criteria: { 
                    name: params.name, version: params.version 
                }};
                action.acquire('data.package.read', next);
            },
            function (result, unused, next) {
                var package = null,
                    url = null;
                
                logger.done(result);
                
                logger.start('Ensuring the required package ' + params.name + 
                             '@' + params.version + ' exist');
                if (0 === result.affected) {
                    next(new C.caligula.errors.PackageNotFoundError(
                        'Required package ' + params.name + '@' + 
                        params.version + ' does not exist'
                    ));
                    return;
                }
                package = result.data[0];
                logger.done(package);
                
                logger.start('Generating the download url for package ' + 
                             params.name + '@' + params.version);
                
                url = package.locations[0] + params.name + '-' + 
                      params.version + '.x86_64.rpm';

                next(null, url);
            }
        ], function (error, result) {
            if (error) {
                logger.error(error);
                action.error(error);
                return;
            }
            
            logger.done(result);
            action.done(result);
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
    PackageHandler.prototype.lock_ = function(action, callback) {
        var params = action.data,
            logger = C.logging.getStepLogger(this.logger_);
        
        logger.start('Calling lock.acquire on "package.' + params.name + '"');
        
        action.data = { 
            name: 'package.' + params.name,
            lease: 10000 // double the lifespan for calling file.upload
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
    PackageHandler.prototype.unlock_ = function(action, id, callback) {
        var params = action.data,
            logger = C.logging.getStepLogger(this.logger_);
        
        callback = callback || function () {};
        logger.start('Calling lock.release on "package.' + params.name + '"');
        
        action.data = { name: 'package.' + params.name, owner: id };
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
    
    C.namespace('caligula.handlers').PackageHandler = PackageHandler;
    
    /**
     * This type of error is desgiend to be thrown when the required package can
     * not be found.
     * 
     * @class PackageNotFoundError
     * @constructor
     * @extends NotFoundError
     * @param {String} message the error message
     */
    function PackageNotFoundError (message) {
        /* inheritance */
        this.super(5, message);
    }
    C.lang.inherit(PackageNotFoundError, C.caligula.errors.NotFoundError);
    C.namespace('caligula.errors').PackageNotFoundError = PackageNotFoundError;
    
    /**
     * This type of error is desgiend to be thrown when the version of the
     * package to be release already exists
     * 
     * @class PackageAlreadyExistError
     * @constructor
     * @extends ConflictError
     * @param {String} message the error message
     */
    function PackageAlreadyExistError (message) {
        /* inheritance */
        this.super(4, message);
    }
    C.lang.inherit(PackageAlreadyExistError, C.caligula.errors.ConflictError);
    C.namespace('caligula.errors').PackageAlreadyExistError = PackageAlreadyExistError;
    
}, '0.0.1', { requires: ['caligula.handlers.base'] });
