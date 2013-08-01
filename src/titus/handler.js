/**
 * This module contains the implementation of class OrcaHandler, which is
 * designed to serve the incoming orchestration requests and provide client
 * side functionalities, such as executing a command, etc.
 *
 * @module caligula.components.orca.handler
 */
Condotti.add('caligula.components.orca.handler', function (C) {
    /**
     * The enumerables defined for node state
     * 
     * @property NodeState
     * @type Object
     */
    var NodeState = C.caligula.orchestration.NodeState;
    
    /**
     * This OrcaHandler is a child of the abstract base class Handler, and is
     * designed as the only one handler for the client agent of Orchestration
     * to serve the Orchestration internal requests and provides the client
     * side functionalities, such as executing a command, etc.
     *
     * @class OrcaHandler
     * @constructor
     * @extends Handler
     * @param {Object} config the config object for this handler
     */
    function OrcaHandler (config) {
        /* inheritance */
        this.super();
        
        /**
         * The config object for this handler
         *
         * @property config_
         * @type Object
         */
        this.config_ = config;
    }
    
    C.lang.inherit(OrcaHandler, C.caligula.handlers.Handler);
    
    /**
     * Handle the "TEE" command
     *
     * @method tee
     * @param {Action} action the "TEE" action to be handled
     */
    OrcaHandler.prototype.tee = function (action) {
        var self = this,
            path = null,
            fd = null,
            stats = null,
            logger = C.logging.getStepLogger(this.logger_),
            MAX_TEE_SIZE = 10 * 1024; // 10K
        
        path = C.natives.path.resolve(this.config_.root, action.job);
        
        C.async.waterfall([
            function (next) {
                logger.start('Checking if job ' + action.job + 
                             ' exists under path "' + path + '"');
                C.natives.fs.exists(path, next.bind(null, null));
            },
            function (exists, next) {
                var error = null;
                
                logger.done(exists);
                if (!exists) {
                    error = new C.caligula.errors.JobNotFoundError(
                        'Required job ' + action.job + ' can not be found'
                    );
                    next(error);
                    return;
                }
                
                path = C.natives.path.resolve(path, 'output');
                logger.start('Checking if the "output" file exists under path ' +
                             path);
                C.natives.fs.exists(path, next.bind(null, null));
            },
            function (exists, next) {
                var error = null;
            
                logger.done(exists);
            
                if (!exists) {
                    error = new C.caligula.errors.JobDataNotFoundError(
                        'OUTPUT for job ' + action.job + ' can not be found'
                    );
                    next(error);
                    return;
                }
                logger.start('Checking the length of the OUTPUT file ' + path);
                C.natives.fs.stat(path, next);
            },
            function (result, next) {
                logger.done(result);
                stats = result;

                if (stats.size === 0) {
                    self.logger_.warn('OUTPUT file ' + path + ' is empty.');
                    next(null, null);
                    return;
                }

                logger.start('Reading the OUTPUT from file ' + path);
                C.natives.fs.open(path, 'r', next);
            },
            function (result, next) {
                var buffer = null,
                    size = null;

                if (!result) {
                    next(null, null, null);
                    return;
                }
                
                logger.done(result);
                fd = result;
                size = Math.min(stats.size, MAX_TEE_SIZE);
                
                logger.start('Reading the ending ' + size + 
                             ' bytes from the output');
                buffer = new Buffer(size);
                C.natives.fs.read(fd, buffer, 0, size, 
                                  Math.max(0, stats.size - MAX_TEE_SIZE), next);
            }
        ], function (error, read, buffer) {
            var content = null;
            
            if (null !== fd) {
                C.natives.fs.close(fd);
            }
            
            if (error) {
                if (!error.code) {
                    logger.error(error);
                }
                action.error(error);
                return;
            }
            
            if (buffer) {
                content = buffer.toString();
                logger.done(content);
            } else {
                content = '';
            }
            
            action.done(content);
        });
    };


    /**
     * Handle the "STAT" command. The data structure of the stat object is defined
     * as following:
     * {
     *     "state": 'FAILED',
     *     "code": ${error code},
     *     "message": "${error message}"
     * }
     * 
     * or
     * 
     * {
     *     "state": 'EXITED',
     *     "code": ${exit code}
     * }
     * 
     * or
     * 
     * {
     *     "state": 'KILLED',
     *     "code": ${signal received}
     * }
     * 
     * or
     * 
     * {
     *     "state": 'TIMEOUT'
     * }
     * 
     * @method stat
     * @param {Action} action the "STAT" action to be handled
     */
    OrcaHandler.prototype.stat = function (action) {
        var self = this,
            path = null,
            child = null,
            logger = C.logging.getStepLogger(this.logger_),
            stat = null;
        
        path = C.natives.path.resolve(this.config_.root, action.job);
        
        child = action.running[action.job];
        if (child) {
            this.logger_.debug('STAT: RUNNING, child: ' + child.pid + ', job: ' + 
                               action.job);
            action.done({ state: NodeState.RUNNING });
            return;
        }
    
        C.async.waterfall([
            function (next) {
                logger.start('Checking if the job ' + action.job + 
                             ' exists under path ' + path);
                C.natives.fs.exists(path, next.bind(null, null));
            },
            function (exists, next) {
                logger.done(exists);
            
                if (!exists) {
                    next(new C.caligula.errors.JobNotFoundError(
                        'Job ' + action.job + ' can not be found.'
                    ));
                    return;
                }
            
                path = C.natives.path.resolve(path, 'stat');
                logger.start('Checking if the "stat" file exists under path ' +
                             path);
                C.natives.fs.exists(path, next.bind(null, null));
            },
            function (exists, next) {
                var error = null;
            
                logger.done(exists);
            
                if (!exists) {
                    next(new C.caligula.errors.JobDataNotFoundError(
                        'STAT for job ' + action.job + ' can not be found'
                    ));
                    return;
                }
            
                logger.start('Reading the STAT from file ' + path);
                C.natives.fs.readFile(path, next);
            },
            function (data, next) {
                logger.done(data.toString());
                logger.start('Parsing STAT JSON ' + data.toString() + 
                             ' for job ' + action.job);
                
                try {
                    next(null, JSON.parse(data));
                } catch (e) {
                    logger.error(e);
                    next(new C.caligula.errors.InternalServerError(
                        'Loading STAT for job ' + action.job + 
                        ' failed. Detail: ' + e.message
                    ));
                }
            }
        ], function (error, stat) {
            var result = null;
            
            if (error) {
                if (!error.code) {
                    logger.error(error);
                }
                action.error(error);
                return;
            }
            
            logger.done(stat);
            
            result = {};
            if (stat.timeout) {
                result.state = NodeState.TIMEOUT;
            } else if (stat.cancelled) {
                result.state = NodeState.CANCELLED;
            } else if (!stat.signal) {
                result.state = NodeState.EXITED;
                result.code = stat.code;
            } else {
                result.state = NodeState.KILLED;
                result.signal = stat.signal;
            }
            action.done(result);
        });
    
    };


    /**
     * Handle the "CANCEL" command
     *
     * @method cancel
     * @param {Action} action the "CANCEL" action to be handled
     */
    OrcaHandler.prototype.cancel = function (action) {
        var self = this,
            path = null,
            child = null,
            logger = C.logging.getStepLogger(this.logger_);
        
        path = C.natives.path.resolve(this.config_.root, action.job);
        
        child = action.running[action.job];
        if (child) {
            this.logger_.debug('Job ' + action.job + ' is still running');
        
            // remove the running item in order to notify the "exit" handler
            // registered by "EXEC" handler that the job is cancelled
            delete action.running[action.job];
        
            child.cancelled = true;
        
            if (child.timer) { // remove the timeout handler
                clearTimeout(child.timer);
                child.timer = null;
            }
        
            this.logger_.debug('Send SIGTERM to the child process ' + 
                               child.pid + ' for job ' + action.job);
        
        
            child.kill();
            action.done({});
            return;
        }
        
        // Handling the cases that running child can not be found in this.running_
    
        // Check if the "stat" file exists, which indicates whether the job has been
        // completed
        logger.start('Checking if the "stat" file exists under "' + path + '"');
        C.natives.fs.exists(C.natives.path.resolve(path, 'stat'), 
                            function (exists) {
            var error = null;
            logger.done(exists);
            if (exists) {
                action.done({});
                return;
            }
            
            action.error(new C.caligula.errors.JobNotFoundError(
                'Child process for job ' + action.job + 
                ' can not be found, or it\'s not managed by this orca.'
            ));
        });
    };


    /**
     * Handle the unsupported command
     *
     * @method default
     * @param {Action} action the unsupported action to be handled
     */
    OrcaHandler.prototype.default = function (action) {
        var error = null;
    
        error = new C.caligula.errors.UnsupportedCommandTypeError(
            'Unsupported command "' + action.name + '" found.'
        );
        this.logger_.error('Job ' + action.job + 
                           ' requires an unsupported command "' + action.name + 
                           '"');
        action.error(error);
    };


    /**
     * Handle the received EXEC command
     *
     * @method exec
     * @param {Action} action the "EXEC" action to be handled
     */
    OrcaHandler.prototype.exec = function (action) {
        var mkdirp = C.require('mkdirp'),
            self = this,
            path = null,
            logger = C.logging.getStepLogger(this.logger_);
        
        path = C.natives.path.resolve(this.config_.root, action.job);
        
        C.async.waterfall([
            function (next) { // Check if the job already exist
                logger.start('Looking up if the job directory "' + path + 
                             '" already exists');
                C.natives.fs.exists(path, next.bind(null, null));
            },
            function (exists, next) { // create directory and files
                var error = null;
                logger.done(exists);
            
                if (!exists) {
                    logger.start('Making the job directory ' + path);
                    mkdirp(path, next);
                    return;
                }
            
                // TODO: add customized error type
                error = new C.caligula.errors.JobAlreadyExecutedError(
                    'Job ' + action.job + ' has been executed'
                );
                self.logger_.error(error);
                next(error);
            },
            function (made, next) { // spawn the child process to execute the job
                var child = null,
                    output = null;
            
                logger.done(made);
            
                logger.start('Creating stdout/err output file under ' + path);
                try {
                    output = C.natives.fs.createWriteStream(
                        C.natives.path.resolve(path, 'output')
                    );
                } catch (e) {
                    logger.error(e);
                    next(new C.caligula.errors.InternalServerError(
                        'Creating stdout/err output file failed.'
                    ));
                    return;
                }
            
                logger.done();
                logger.start('Excuting the job "' + action.data.command + 
                             ' ' + action.data.arguments.join(' ') + '"');
                try {
                    child = C.natives.child_process.spawn(
                        action.data.command,
                        action.data.arguments,
                        { detached: true } // TODO: add uid and gid support
                    );
                } catch (e) {
                    logger.error(e);
                    next(new C.caligula.errors.InvalidArgumentError(
                        e.toString()
                    ));
                    return;
                }
            
                child.stdout.pipe(output);
                child.stderr.pipe(output);
            
                // bind the "exit" event to remove from running table and
                // create the "stat" file
                child.on('exit', function (code, signal) {
                    
                    if (child.timer) {
                        clearTimeout(child.timer);
                        child.timer = null;
                    }
                
                    C.natives.fs.writeFile(
                        C.natives.path.resolve(path, 'stat'),
                        JSON.stringify({ 
                            code: code, 
                            signal: signal,
                            cancelled: child.cancelled,
                            timeout: child.timeout
                        }, null, 4)
                    );
                
                    delete action.running[action.job];
                    // send "NOTIFY" to the API server?
                });
            
                // setup the timeout watcher
                child.timer = setTimeout(function () {
                    self.logger_.warn('Child process ' + child.pid + ' for job ' +
                                      action.job + ' timeout.');
                    child.timer = null;
                    child.timeout = true;
                    delete action.running[action.job];
                    child.kill();
                }, action.data.timeout);
            
                // create pid file
                C.natives.fs.writeFile(
                    C.natives.path.resolve(path, 'pid'),
                    child.pid.toString()
                );
            
                child.unref();
                action.running[action.job] = child;
                next();
            }
        
        ], function (error) {
            if (error) {
                if (!error.code) {
                    logger.error(error);
                }
            
                action.error(error);
                return;
            }
            logger.done();
            action.done({});
        });
    };
    
    
    C.namespace('caligula.handlers').OrcaHandler = OrcaHandler;
    
    /**
     * This type of error is to be thrown when the data for the required job 
     * can not be found.
     *
     * @class JobDataNotFoundError
     * @constructor
     * @extends NotFoundError
     * @param {String} message the error message describe this error
     */
    function JobDataNotFoundError (message) {
        /* inheritance */
        this.super(7, message);
    }
    C.lang.inherit(JobDataNotFoundError, C.caligula.errors.NotFoundError);

    C.namespace('caligula.errors').JobDataNotFoundError = JobDataNotFoundError;
    
    /**
     * This type of error is desgiend to be thrown when the required job has
     * been executed
     * 
     * @class JobAlreadyExecutedError
     * @constructor
     * @extends ConflictError
     * @param {String} message the error message
     */
    function JobAlreadyExecutedError (message) {
        /* inheritance */
        this.super(5, message);
    }
    C.lang.inherit(JobAlreadyExecutedError, C.caligula.errors.ConflictError);
    C.namespace('caligula.errors').JobAlreadyExecutedError = JobAlreadyExecutedError;
    
    /**
     * This type of error is desgiend to be thrown when the required command is
     * not supported
     * 
     * @class UnsupportedCommandTypeError
     * @constructor
     * @extends UnsupportedTypeError
     * @param {String} message the error message
     */
    function UnsupportedCommandTypeError (message) {
        /* inheritance */
        this.super(1, message);
    }
    C.lang.inherit(UnsupportedCommandTypeError, C.caligula.errors.UnsupportedTypeError);
    C.namespace('caligula.errors').UnsupportedCommandTypeError = UnsupportedCommandTypeError;
    
}, '0.0.1', { requires: ['caligula.handlers.base', 'caligula.components.orchestration.base'] });
