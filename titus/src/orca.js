/**
 * The main module for the orchestration client - orca
 *
 * @module orca
 */

var condotti = require('condotti'),
    Kafka = require('franz-kafka'),
    mkdirp = require('mkdirp'),
    C = null,
    config = null;

/**
 * The enumerables defined for node state
 * 
 * @property NodeState
 * @type Object
 */
var NodeState = {
    RUNNING: 0,
    DONE: 10,
    EXITED: 11,
    CANCELLED: 12,
    KILLED: 13,
    TIMEOUT: 14,
    FAILED: 20 // Unknown state of the child process
};

/******************************************************************************
 *                                                                            *
 *                               ORCA CLASS                                   * 
 *                                                                            *
 *****************************************************************************/

/**
 * This Orca class is the main class for the client orca
 *
 * @class Orca
 * @constructor
 * @param {Object} config the config object for this orca
 */
function Orca (config) {
    
    /**
     * The config object for this orca
     *
     * @property config_
     * @type Object
     */
    this.config_ = config;
    
    /**
     * The logger instance for this orca
     *
     * @property logger_
     * @type Logger
     */
    this.logger_ = C.logging.getObjectLogger(this);
    
    /**
     * The running jobs
     * 
     * @property running_
     * @type Object
     * @deafult {}
     */
    this.running_ = {};
    
    /**
     * The Kafka client instance
     * 
     * @property kafka_
     * @type Kafka
     * @deafult null
     */
    this.kafka_ = null;
    
    /* initialize */
    this.initialize_();

}

/**
 * Initialize this Orca client
 *
 * @method initialize_
 */
Orca.prototype.initialize_ = function () {
    this.logger_.info('Initializing Orca client "' + this.config_.id +
                      '" with config ' + C.lang.reflect.inspect(this.config_));
    
    this.config_.kafka.logger = C.logging.getLogger('Kafka - ORCA');
    this.kafka_ = Kafka(this.config_.kafka);
    this.kafka_.on('connect', this.onKafkaConnect_.bind(this));
    
    this.logger_.info('Orca client "' + this.config_.id + '" is initialized.');
};

/**
 * The "connect" event handler for the Kafka client. Because the Kafka client
 * can try to reconnect to the brokers when disconnected, this handler may be
 * called multiple times.
 *
 * @method onKafkaConnect_
 */
Orca.prototype.onKafkaConnect_ = function () {
    var topic = null;
    
    this.logger_.debug('Kafka client becomes connected to the servers');
    
    topic = this.kafka_.topics[this.config_.id];
    if (!topic) { // first time called
        this.logger_.debug('Kafka client connects to the servers first time');
        
        topic = this.kafka_.topic(this.config_.id, this.config_.consumer);
        topic.on('data', this.onKafkaConsumerData_.bind(this));
        
        // consumer won't emit error
        // topic.on('error', self.onKafkaConsumerError_.bind(self));
        this.logger_.info('Orca is now running.');
    }
    
    // try to call resume again to continue receiving data
    topic.resume();
};


/**
 * Start the orca client to run
 *
 * @method run
 */
Orca.prototype.run = function () {
    this.logger_.info('Starting orca client ' + this.config_.id + ' ...');
    this.kafka_.connect();
};

/**
 * The "data" event handler for the subscription topic
 *
 * @method onKafkaConsumerData_
 * @param {String} data the data received from Kafka
 * @return {} 
 */
Orca.prototype.onKafkaConsumerData_ = function (data) {
    var message = null;
    
    try {
        message = JSON.parse(data);
    } catch (e) {
        this.logger_.error('Malformed JSON message received: ' + data);
        return;
    }
    
    this.logger_.debug('Message received: ' + C.lang.reflect.inspect(message));
    
    switch (message.command) {
    case 'EXEC':
        this.handleExecCommand_(message);
        break;
    case 'STAT':
        this.handleStatCommand_(message);
        break;
    case 'TEE':
        this.handleTeeCommand_(message);
        break;
    case 'CANCEL':
        this.handleCancelCommand_(message);
        break;
    default:
        this.handleUnsupportedCommand_(message);
        break;
    }
    
};

/**
 * Handle the "TEE" command
 *
 * @method handleTeeCommand_
 * @param {Object} message the "TEE" message to be handled
 */
Orca.prototype.handleTeeCommand_ = function (message) {
    var self = this,
        path = null,
        response = null,
        fd = null,
        logger = C.logging.getStepLogger(this.logger_);
    
    path = C.natives.path.resolve(this.config_.root, message.job);
    response = {
        id: message.id,
        sender: this.config_.id,
        job: message.job
    };
    
    C.async.waterfall([
        function (next) {
            logger.start('Checking if job ' + message.job + 
                         ' exists under path "' + path + '"');
            C.natives.fs.exists(path, next);
        },
        function (exists, next) {
            var error = null;
            
            logger.done(exists);
            if (!exists) {
                error = new JobNotFoundError('Required job ' + message.job + 
                                             ' can not be found');
                next(error);
                return;
            }
            
            path = C.natives.path.resolve(path, 'output');
            logger.start('Checking if the "output" file exists under path ' +
                         path);
            C.natives.fs.exists(path, next);
        },
        function (exists, next) {
            var error = null;
            
            logger.done(exists);
            
            if (!exists) {
                error = new JobDataNotFoundError('OUTPUT for job ' + 
                                                 message.job + 
                                                 ' can not be found');
                next(error);
                return;
            }
            
            logger.start('Reading the OUTPUT from file ' + path);
            C.natives.fs.open(path, 'r', next);
        },
        function (result, next) {
            var buffer = null;
            logger.done(result);
            fd = result;
            
            logger.start('Reading the begining 10K bytes from the output');
            buffer = new Buffer(10 * 1024); // 10K
            C.natives.fs.read(fd, buffer, 0, 10 * 1024, 0, next);
        }
    ], function (error, read, buffer) {
        if (error) {
            if (!error.code) {
                logger.error(error);
            }
            
            response.error = { 
                code: error.code || 50000,
                message: error.message
            };
            
        } else {
            logger.done(buffer.toString());
            response.result = buffer.toString();
        }
        
        if (null !== fd) {
            C.natives.fs.close(fd);
        }
        
        self.dispatch_(message.sender, response);
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
 * @method handleStatCommand_
 * @param {Object} message the "STAT" message to be handled
 */
Orca.prototype.handleStatCommand_ = function (message) {
    var self = this,
        path = null,
        response = null,
        child = null,
        logger = C.logging.getStepLogger(this.logger_),
        stat = null;
        
    path = C.natives.path.resolve(this.config_.root, message.job);
    response = {
        id: message.id,
        sender: this.config_.id,
        job: message.job
    };
    
    child = this.running_[message.job];
    if (child) {
        response.result = { state: states.RUNNING };
        this.logger_.debug('STAT: RUNNING, child: ' + child.pid + ', job: ' + 
                           message.job);
        this.dispatch_(message.sender, response);
        return;
    }
    
    C.async.waterfall([
        function (next) {
            logger.start('Checking if the job ' + message.job + 
                         ' exists under path ' + path);
            C.natives.fs.exists(path, next);
        },
        function (exists, next) {
            logger.done(exists);
            
            if (!exists) {
                next(new JobNotFoundError('Job ' + message.job + 
                                          ' can not be found.'));
                return;
            }
            
            path = C.natives.path.resolve(path, 'stat');
            logger.start('Checking if the "stat" file exists under path ' +
                         path);
            C.natives.fs.exists(path, next);
        },
        function (exists, next) {
            var error = null;
            
            logger.done(exists);
            
            if (!exists) {
                next(new JobDataNotFoundError('STAT for job ' + message.job + 
                                              ' can not be found'));
                return;
            }
            
            logger.start('Reading the STAT from file ' + path);
            C.natives.fs.readFile(path, next);
        },
        function (data, next) {
            logger.done(data.toString());
            logger.start('Parsing STAT JSON ' + data.toString() + ' for job ' +
                         message.job);
                         
            try {
                next(null, JSON.parse(data));
            } catch (e) {
                logger.error(e);
                next(new InternalServerError('Loading STAT for job ' + 
                                             message.job + 
                                             ' failed. Detail: ' + e.message));
            }
        }
    ], function (error, stat) {
        if (error) {
            if (!error.code) {
                logger.error(error);
            }
            
            response.error = { 
                code: error.code || 50000, 
                message: error.message
            };
            
        } else {
            logger.done(stat);
            response.result = {};
            
            if (stat.timeout) {
                response.result.state = states.TIMEOUT;
            } else if (stat.cancelled) {
                response.result.state = states.CANCELLED;
            } else if (!stat.signal) {
                response.result.state = states.EXITED;
                response.result.code = stat.code;
            } else {
                response.result.state = states.KILLED;
                response.result.signal = stat.signal;
            }
        }
        
        self.dispatch_(message.sender, response);
    });
    
};


/**
 * Handle the "CANCEL" command
 *
 * @method handleCancelCommand_
 * @param {Object} message the "CANCEL" message to be handled
 */
Orca.prototype.handleCancelCommand_ = function (message) {
    var self = this,
        path = null,
        response = null,
        child = null,
        logger = C.logging.getStepLogger(this.logger_);
        
    path = C.natives.path.resolve(this.config_.root, message.job);
    response = {
        id: message.id,
        sender: this.config_.id,
        job: message.job
    };
    
    child = this.running_[message.job];
    if (child) {
        this.logger_.debug('Job ' + message.job + ' is still running');
        
        // remove the running item in order to notify the "exit" handler
        // registered by "EXEC" handler that the job is cancelled
        delete this.running_[message.job];
        
        child.cancelled = true;
        
        if (child.timer) { // remove the timeout handler
            clearTimeout(child.timer);
            child.timer = null;
        }
        
        this.logger_.debug('Send SIGTERM to the child process ' + child.pid + 
                           ' for job ' + message.job);
        
        
        child.kill();
        response.result = {};
        self.dispatch_(message.sender, response);
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
            response.result = {};
        } else {
            error = new JobNotFoundError('Child process for job ' + 
                                         message.job + 
                                         ' can not be found, or it\'s not ' +
                                         'managed by this orca.');
            response.error = { 
                code: error.code, 
                message: error.message
            };
        }
        self.dispatch_(message.sender, response);
    });
};


/**
 * Handle the unsupported command
 *
 * @method handleUnsupportedCommand_
 * @param {Object} message the message to be handled
 */
Orca.prototype.handleUnsupportedCommand_ = function (message) {
    var response = null,
        error = null;
    
    error = new UnsupportedCommandTypeError('Unsupported command "' + 
                                            message.command + '" found.');
    response = {
        id: message.id,
        sender: this.config_.id,
        job: message.job,
        error: {
            code: error.code,
            message: error.message
        }
    };
    
    this.logger_.error('Job ' + message.job + 
                       ' requires an unsupported command "' + message.command + 
                       '"');
    this.dispatch_(message.sender, response);
};


/**
 * Handle the received EXEC command
 *
 * @method handleExecCommand_
 * @param {Object} message the "EXEC" message received
 */
Orca.prototype.handleExecCommand_ = function (message) {
    var self = this,
        path = null,
        response = null,
        logger = C.logging.getStepLogger(this.logger_);
        
    path = C.natives.path.resolve(this.config_.root, message.job);
    response = {
        id: message.id,
        sender: this.config_.id,
        job: message.job
    };
    
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
            error = new JobAlreadyExecutedError('Job ' + message.job + 
                                                ' has been executed');
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
                next(new InternalServerError(
                    'Creating stdout/err output file failed.'
                ));
                return;
            }
            
            logger.done();
            logger.start('Excuting the job "' + message.params.command + 
                         ' ' + message.params.arguments.join(' ') + '"');
            try {
                child = C.natives.child_process.spawn(
                    message.params.command,
                    message.params.arguments,
                    { detached: true } // TODO: add uid and gid support
                );
            } catch (e) {
                logger.error(e);
                next(new InvalidArgumentError(e.toString()));
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
                
                delete self.running_[message.job];
                // send "NOTIFY" to the API server?
            });
            
            // setup the timeout watcher
            child.timer = setTimeout(function () {
                self.logger_.warn('Child process ' + child.pid + ' for job ' +
                                  message.job + ' timeout.');
                child.timer = null;
                child.timeout = true;
                delete self.running_[message.job];
                child.kill();
            }, message.params.timeout);
            
            // create pid file
            C.natives.fs.writeFile(
                C.natives.path.resolve(path, 'pid'),
                child.pid.toString()
            );
            
            child.unref();
            self.running_[message.job] = child;
            next();
        }
        
    ], function (error) {
        if (error) {
            if (!error.code) {
                logger.error(error);
            }
            
            response.error = {
                code: error.code || 50000,
                message: error.message
            };
        } else {
            logger.done();
            response.result = {};
        }
        
        self.dispatch_(message.sender, response);
    });
};

/**
 * Send back response message
 *
 * @method dispatch_
 * @param {String} target the target to be dispatched to
 * @param {Object} message the message to be dispatched
 */
Orca.prototype.dispatch_ = function (target, message) {
    var topic = null,
        content = null,
        self = this,
        logger = C.logging.getStepLogger(this.logger_);
    
    content = JSON.stringify(message);
    logger.start('Dispatching message ' + C.lang.reflect.inspect(message) + 
                 ' to target "' + target + '"');
                       
    topic = this.kafka_.topics[target];
    if (topic) {
        topic.write(content);
        logger.done();
        return;
    }
    
    this.logger_.debug('Topic "' + target + '" is initialized first time');
    topic = this.kafka_.topic(target, this.config_.producer);
    topic.on('drain', function () {
        self.logger_.debug('Topic ' + target + ' is writable now');
    }).on('error', function (error) {
        self.logger_.error('Error occurs on the producer of topic "' +
                           target + '". Details: ' +
                           C.lang.reflect.inspect(error));
        // this error is raised by the client of the broker instance,
        // since the net.Socket will close the connection after emitting
        // an 'error' event, nothing else needed to be done for this
        // handler
        
        // Update: it seems that error is only raised during processing
        //         messages, those ones occur on the underlying socket
        //         are simply logged and then ignored.
        //         TODO: test it?
    });
    
    topic.write(content);
    logger.done();
};


/******************************************************************************
 *                                                                            *
 *                                  ERRORS                                    * 
 *                                                                            *
 *****************************************************************************/


/**
 * This type of error is desgiend to be thrown when the job required to be
 * executed has already been executed
 * 
 * @class JobAlreadyExecutedError
 * @constructor
 * @extends Error
 * @param {String} message the error message
 */
function JobAlreadyExecutedError (message) {
    this.name = 'JobAlreadyExecutedError';
    this.message = message;
    this.code = 40905;
}
C.lang.inherit(JobAlreadyExecutedError, Error);


/**
 * This type of error is desgiend to be thrown when the required job can not be
 * found.
 * 
 * @class JobNotFoundError
 * @constructor
 * @extends Error
 * @param {String} message the error message
 */
function JobNotFoundError (message) {
    this.name = 'JobNotFoundError';
    this.message = message;
    this.code = 40406;
}
C.lang.inherit(JobNotFoundError, Error);


/**
 * This type of error is desgiend to be thrown when the required data, such as
 * the output or the stat, for the specified job can not be found.
 * 
 * @class JobDataNotFoundError
 * @constructor
 * @extends Error
 * @param {String} message the error message
 */
function JobDataNotFoundError (message) {
    this.name = 'JobDataNotFoundError';
    this.message = message;
    this.code = 40407;
}
C.lang.inherit(JobDataNotFoundError, Error);

/**
 * This type of error is desgiend to be thrown when some internal server related
 * error occurs.
 * 
 * @class InternalServerError
 * @constructor
 * @extends Error
 * @param {String} message the error message
 */
function InternalServerError (message) {
    this.name = 'InternalServerError';
    this.message = message;
    this.code = 50000;
}
C.lang.inherit(InternalServerError, Error);

/**
 * This type of error is desgiend to be thrown when some of the provided
 * arguments is invalid
 * 
 * @class InvalidArgumentError
 * @constructor
 * @extends Error
 * @param {String} message the error message
 */
function InvalidArgumentError (message) {
    this.name = 'InvalidArgumentError';
    this.message = message;
    this.code = 40001;
}
C.lang.inherit(InvalidArgumentError, Error);

/**
 * This type of error is desgiend to be thrown when the required command is not
 * supported
 * 
 * @class UnsupportedCommandTypeError
 * @constructor
 * @extends Error
 * @param {String} message the error message
 */
function UnsupportedCommandTypeError (message) {
    this.name = 'UnsupportedCommandTypeError';
    this.message = message;
    this.code = 41501;
}
C.lang.inherit(UnsupportedCommandTypeError, Error);

/******************************************************************************
 *                                                                            *
 *                                  MAIN                                      * 
 *                                                                            *
 *****************************************************************************/

if (require.main === module) {
    // main
    process.stdout.write('>>> Loading config from file "' + process.argv[2] +
                         '" ...');
    try {
        config = require(process.argv[2])
    } catch (e) {
        process.stdout.write('\t\t[ !! ]\n');
        process.stdout.write('  * Error: ' + e.toString() + '\n');
        process.exit(0);
    }
    process.stdout.write('\t\t[ OK ]\n');
    
    C = condotti.Condotti(config.condotti);
    
    try {
        new Orca(config.orca).run();
    } catch (e) {
        process.exit(1);
    }
}