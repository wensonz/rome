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
    
    C.namespace('caligula.handlers').PackageHandler = PackageHandler;
    
}, '0.0.1', { requires: ['caligula.handlers.base', 'caligula.logging'] });