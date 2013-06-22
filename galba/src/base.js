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
     */
    function PackageHandler () {
        /* inheritance */
        this.super();
        
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
            logger = C.caligula.logging.getStepLogger(this.logger_),
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
                var name = null;
                
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
                
                name = params.name + '-' + params.version + '.rpm';
                logger.start('Uploading the package file ' + name + 
                             ' with md5: ' + params.md5);
                             
                action.data = { name: name, md5: params.md5 };
                action.acquire('file.upload', next);
            },
            function (result, unused, next) {
                logger.done();
                
                action.data = params;
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
            logger = C.caligula.logging.getStepLogger(this.logger_);
            
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
                var name = null;
                
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
                
                logger.done();
                
                name = params.name + '-' + params.version + '.rpm';
                logger.start('Downloading package file ' + name);
                action.data = { name: name, dryrun: true };
                action.acquire('file.download', next);
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
            logger = C.caligula.logging.getStepLogger(this.logger_);
        
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
            logger = C.caligula.logging.getStepLogger(this.logger_);
        
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
        this.super(4, message);
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
    
}, '0.0.1', { requires: ['caligula.handlers.base', 'caligula.logging'] });