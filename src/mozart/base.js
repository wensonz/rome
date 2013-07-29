/**
 * This module contains the implementation of the orchestration APIs.
 *
 * @module caligula.components.orchestration.base
 */
Condotti.add('caligula.components.orchestration.base', function (C) {
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
    
    C.namespace('caligula.orchestration').NodeState = NodeState;
    
    /**
     * The enumerables defined for job state
     *
     * @property JobState
     * @type Object
     */
    var JobState = {
        RUNNING: 0,
        DONE: 1,
        CANCELLING: 2,
        CANCELLED: 3
    };
    
    C.namespace('caligula.orchestration').JobState = JobState;
    
    /**
     * This OrchestrationHandler is a child class of Handler, and designed to 
     * provide orchestration functionalities via HTTP API
     *
     * @class OrchestrationHandler
     * @constructor
     * @extends Handler
     * @param {Object} config the config object for this handler
     */
    function OrchestrationHandler (config) {
        /* inheritance */
        this.super();
        
        /**
         * The config object for this handler
         * 
         * @property config_
         * @type Object
         */
        this.config_ = config;
        
        /**
         * The Kafka client for messaging publishing and subscription
         * 
         * @property kafka_
         * @type Kafka
         * @deafult null
         */
        this.kafka_ = null;

        /**
         * The offset of the topic this Kafka client to consume from
         *
         * @property offset_
         * @type Number
         * @default 0
         */
        this.offset_ = 0;
        
        /**
         * Whether the kafka client has been successfully setup
         * 
         * @property ready_
         * @type Boolean
         * @deafult false
         */
        this.ready_ = false;
        
        /**
         * The dispathcing collection
         * 
         * @property dispatching_
         * @type Object
         * @deafult {}
         */
        this.dispatching_ = {};
        
        /**
         * The uptime to filter out expired messages from Kafka
         * WTF!!
         * 
         * @property uptime_
         * @type Number
         */
        this.uptime_ = Math.floor(Date.now() / 1000);
        
        /* initialize */
        this.initialize_();
    }
    
    C.lang.inherit(OrchestrationHandler, C.caligula.handlers.Handler);
    
    /**
     * Initialize this handler
     * 
     * @method initialize_
     */
    OrchestrationHandler.prototype.initialize_ = function () {
        var Kafka = C.require('franz-kafka'),
            config = null,
            self = this,
            offset = null;

        try {
            this.offset_ = parseInt(
                C.natives.fs.readFileSync(this.config_.offset)
            );
            this.logger_.debug('Offset for topic ' + this.config_.id + ': ' +
                               this.offset_);
        } catch {
            this.logger_.error('Can not read offset from file ' + 
                               this.config_.offset + '. Use 0 as default.');
            this.offset_ = 0;
        }
        
        config = this.config_.kafka;
        config.logger = C.logging.getLogger('Kafka - API');
        
        this.kafka_ = Kafka(this.config_.kafka);
        this.kafka_.on('connect', function () {
            var topic = self.kafka_.topics[self.config_.id];
            
            if (!topic) {
                if (self.config_.consumer && self.config_.consumer.partitions &&
                    self.config_.consumer.partitions.consume) {
                    self.config_.consumer.partitions.consume = [
                        '0-0:' + self.offset_
                    ];
                }

                topic = self.kafka_.topic(self.config_.id, 
                                          self.config_.consumer);
                                          
                topic.on('data', self.onKafkaConsumerData_.bind(self));
                topic.on('offset', self.onKafkaConsumerOffset_.bind(self));
                setInterval(function () {
                    C.natives.fs.writeFileSync(self.config_.offset, 
                                               self.offset_.toString());
                }, 2000); // flush the offset every 2 sec

                // consumer won't emit error
                // topic.on('error', self.onKafkaConsumerError_.bind(self));
            }
            
            topic.resume();
            self.ready_ = true;
        });
        
        this.kafka_.connect();
        this.logger_.info('Uptime (sec): ' + this.uptime_);
    };
    
    /**
     * Return the stat of the specified orchestration job
     *
     * @method stat
     * @param {Action} action the "stat" action to be handled
     */
    OrchestrationHandler.prototype.stat = function (action) {
        var self = this,
            params = action.data,
            job = null,
            logger = C.logging.getStepLogger(this.logger_);
            
        C.async.waterfall([
            function (next) {
                logger.start('Querying the job object with id ' + params.id);
                action.data = { criteria: { id: params.id }};
                action.acquire('data.orchestration.read', next);
            },
            function (result, unused, next) {
                var message = null;
                
                logger.done(result);
                
                if (result.affected < 1) {
                    next(new C.caligula.errors.JobNotFoundError(
                        'Required job ' + params.id + ' can not be found'
                    ));
                    return;
                }
                
                job = result.data[0];
                
                if (job.state.job === JobState.DONE ||
                    job.state.job === JobState.CANCELLED) {
                    self.logger_.debug(
                        'Job ' + job.id + ' has been ' +
                        (job.state.job === JobState.DONE ? 'completed' : 
                                                           'cancelled.')
                    );
                    next(null, null);
                    return;
                }
                
                logger.start('Sending "STAT" commands to nodes ' +
                             job.nodes.toString() + ' for job ' + job.id);
                
                message = {
                    id: C.uuid.v4(),
                    sender: self.config_.id,
                    job: job.id,
                    timestamp: Math.floor(Date.now() / 1000),
                    command: 'STAT'
                };
                self.dispatch_(job, message, next);
            },
            function (result, next) {
                var completed = true,
                    existing = {},
                    nodes = [];
                
                if (!result) {
                    next(null, null);
                    return;
                }
                
                logger.done(result);
                job.state.nodes.forEach(function (node) {
                    existing[node.name] = node;
                });
                // merge the node states
                Object.keys(result).forEach(function (name) {
                    var node = null;

                    if ((result[name].error) && 
                        (result[name].error.code === 40800) &&
                        existing[name]) {
                        node = existing[name]; // the last state
                    } else {
                        node = result[name];
                        node.name = name;
                    }

                    nodes.push(node);

                    if ((node.error && node.error.code === 40800) ||
                        (node.result && node.result.state === NodeState.RUNNING)) {
                        completed = false;
                    }
                });
                
                // job.state.nodes = result;
                job.state.nodes = nodes;
                
                if (completed) {
                    job.state.job = (job.state.job === JobState.RUNNING ?
                                     JobState.DONE : 
                                     JobState.CANCELLED);
                }
                
                logger.start('Saving the new generated state object ' +
                             C.lang.reflect.inspect(job.state));
                action.data = {
                    criteria: { id: job.id },
                    update: { "$set": {
                        state: job.state
                    }}
                };
                action.acquire(
                    'data.orchestration.update', 
                    function (error, result) {
                        if (error) { // ignore the error
                            logger.error(error);
                            next(null, null);
                            return;
                        }
                        
                        next(null, result);
                    }
                );
            }
        ], function (error, result) {
            if (error) {
                logger.error(error);
                action.error(error);
                return;
            }
            
            if (result) {
                logger.done(result);
            }
            
            action.done(job.state);
        });
    };
    
    /**
     * Return the output of the specified job
     *
     * @method tee
     * @param {Action} action the "TEE" action to be handled
     * @return {} 
     */
    OrchestrationHandler.prototype.tee = function (action) {
        var self = this,
            params = action.data,
            logger = C.logging.getStepLogger(this.logger_),
            job = null;
        
        C.async.waterfall([
            function (next) {
                logger.start('Querying the job object with id ' + params.id);
                action.data = { criteria: { id: params.id }};
                action.acquire('data.orchestration.read', next);
            },
            function (result, unused, next) {
                var message = null;
                
                logger.done(result);
                
                if (result.affected < 1) {
                    next(new C.caligula.errors.JobNotFoundError(
                        'Required job ' + params.id + ' can not be found'
                    ));
                    return;
                }
                
                job = result.data[0];
                
                logger.start('Sending "TEE" commands to nodes ' +
                             job.nodes.toString() + ' for job ' + job.id);
                
                message = {
                    id: C.uuid.v4(),
                    sender: self.config_.id,
                    job: job.id,
                    timestamp: Math.floor(Date.now() / 1000),
                    command: 'TEE'
                };
                self.dispatch_(job, message, next);
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

    /**
     * Cancel the specified job
     *
     * @method cancel
     * @param {Action} action the "CANCEL" action to be handled
     */
    OrchestrationHandler.prototype.cancel = function (action) {
        var self = this,
            params = action.data,
            logger = C.logging.getStepLogger(this.logger_),
            job = null;
        
        C.async.waterfall([
            function (next) {
                logger.start('Querying the job object with id ' + params.id);
                action.data = { criteria: { id: params.id }};
                action.acquire('data.orchestration.read', next);
            },
            function (result, unused, next) {
                var message = null;
                
                logger.done(result);
                
                if (result.affected < 1) {
                    next(new C.caligula.errors.JobNotFoundError(
                        'Required job ' + params.id + ' can not be found'
                    ));
                    return;
                }
                
                job = result.data[0];
                if (job.state.job !== JobState.RUNNING) {
                    message = 'Job ' + job.id;
                    switch (job.state.job) {
                    case JobState.CANCELLING:
                        message += ' is being cancelled.';
                        break;
                    case JobState.DONE:
                        message += ' has been completed.';
                        break;
                    case JobState.CANCELLED:
                        message += ' has been cancelled.';
                        break;
                    }
                    self.logger_.warn(message);
                    
                    next(new C.caligula.errors.JobNotCancelledError(
                        message
                    ));
                    return;
                }
                
                job.state.job = JobState.CANCELLING;
                
                action.data = {
                    criteria: { id: job.id },
                    update: {
                        '$set': { 'state.job': job.state.job }
                    }
                };
                logger.start('Updating the job state to be cancelling');
                action.acquire('data.orchestration.update', next);
            },
            function (result, unused, next) {
                var message = null;

                logger.done(result);
                
                // TODO: check if result.affected === 1
                logger.start('Sending "CANCEL" commands to nodes ' +
                             job.nodes.toString() + ' for job ' + job.id);
                
                message = {
                    id: C.uuid.v4(),
                    sender: self.config_.id,
                    job: job.id,
                    command: 'CANCEL',
                    timestamp: Math.floor(Date.now() / 1000)
                };
                
                self.dispatch_(job, message);
                next();
            }
        ], function (error) {
            if (error) {
                logger.error(error);
                action.error(error);
                return;
            }
            
            logger.done();
            action.done();
        });
    };
    
    /**
     * Create an orchestration job for parallel/serial remote execution.
     * 
     * @method create
     * @param {Action} action the creating action to be handled
     */
    OrchestrationHandler.prototype.create = function (action) {
        var self = this,
            logger = C.logging.getStepLogger(this.logger_),
            job = action.data;
            
        // TODO: validations
        job.id = C.uuid.v4();
        job.state = {
            job: JobState.RUNNING,
            nodes: []
        };
        
        C.async.waterfall([
            function (next) { // save into the database
                
                if (job.shortcut) {
                    self.logger_.debug('Job is required to be shortcutted.');
                    next(null, null, null);
                }
                
                logger.start('Saving the job object into data storage');
                action.data = job;
                action.acquire('data.orchestration.create', next);
            },
            function (result, unused, next) { //
                var message = null;
                
                if (result) {
                    logger.done(result);
                }
                
                message = {
                    id: C.uuid.v4(),
                    sender: self.config_.id,
                    job: job.id,
                    command: 'EXEC',
                    timestamp: Math.floor(Date.now() / 1000),
                    params: {
                        command: job.command,
                        arguments: job.arguments,
                        timeout: job.timeout || 60000 // 1 min
                    }
                };
        
                logger.start('Dispatching job message ' + 
                             C.lang.reflect.inspect(message) + 
                             ' to the targeting nodes ' + 
                             job.nodes.toString());
        
                // TODO: update the result
                self.dispatch_(job, message);
                // Return to the caller immediately
                next();
            }
        ], function (error) {
            if (error) {
                logger.error(error);
                action.error(error);
                return;
            }
            
            logger.done();
            action.done({ id: job.id });
        });
    };

    /**
     * The 'offset' event handler for the Kafka topic
     *
     * @method onKafkaConsumerOffset_
     * @param {String} partition the partition emits this event
     * @param {Number} offset the new offset for this consumption
     */
    OrchestrationHandler.prototype.onKafkaConsumerOffset_ = function (partition,
                                                                      offset) {
        this.logger_.debug('New offset arrived: ' + offset);
        this.offset_ = offset;
    };
    
    /**
     * Called when the dispatching timeout, which complement the stat result for
     * the nodes that timeout with an request timeout error object.
     *
     * @method onDispatchTimeout_
     * @param {Object} dispatch the dispatch object which timeout
     */
    OrchestrationHandler.prototype.onDispatchTimeout_ = function (dispatch) {
        var error = null;

        error = new C.caligula.errors.RequestTimeoutError('Request timeout');
        this.logger_.warn('Request ' + dispatch.id + ' for job ' + 
                          C.lang.reflect.inspect(dispatch.job) + 
                          ' timeout. Result: ' +
                          C.lang.reflect.inspect(dispatch.responses));
        
        dispatch.job.nodes.forEach(function (node) {
            if (node in dispatch.responses) {
                return;
            }
            dispatch.responses[node] = { error: {
                code: error.code,
                message: error.message
            }};
        });
        
        delete this.dispatching_[dispatch.id];
        
        if (!dispatch.callback) {
            return;
        }
        
        dispatch.callback(null, dispatch.responses);
    };
    
    
    /**
     * Dispatch the message to the specified targets
     *
     * @method dispatch_
     * @param {Object} job the job object which trigger this dispatching
     * @param {Object} message the message to be dispatched to the targets
     * @param {Function} callback the callback function to be invoked after the
     *                            dispatching has been successfully completed,
     *                            or some error occurs. When a dispatching is
     *                            completed, it means that all targets have 
     *                            accepted the request, such as "EXEC", 
     *                            accomplished the request, such as "STAT", 
     *                            "TEE", or the request timeout after user
     *                            specified time interval. When timeout, the API
     *                            will return whatever it received to the caller
     */
    OrchestrationHandler.prototype.dispatch_ = function (job, message, callback) {
        var content = null,
            self = this,
            dispatch = null;
        
        // TODO: check if ready
        content = JSON.stringify(message);
        
        job.nodes.forEach(function (node) {
            var topic = self.kafka_.topics[node];
            
            if (topic) {
                self.logger_.debug('Topic ' + node + 
                                   ' has been created before');
                topic.write(content);
                return;
            }
            self.logger_.debug('Create topic ' + node + ' for the first time');
            topic = self.kafka_.topic(node, self.config_.producer);
            
            topic.on('drain', function () {
                self.logger_.debug('Topic ' + node + ' is ready to write');
            }).on('error', function (error) {
                self.logger_.error('Error occurs on the producer of topic "' +
                                   node + '". Details: ' +
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
        });
        
        dispatch = {
            id: message.id,
            job: job,
            responses: {},
            callback: callback
        };
        // Timeout handler
        dispatch.timer = setTimeout(
            this.onDispatchTimeout_.bind(this, dispatch), 
            this.config_.timeout
        );
        
        this.dispatching_[dispatch.id] = dispatch;
    };
    
    /**
     * The "data" event handler for the kafka consumer
     *
     * @method onKafkaConsumerData_
     * @param {String} data the data received from the kafka consumer
     */
    OrchestrationHandler.prototype.onKafkaConsumerData_ = function (data) {
        var message = null,
            dispatch = null;
        
        try {
            message = JSON.parse(data);
        } catch (e) {
            // TODO: error handling
            this.logger_.error('Malformed JSON string received: ' + data);
            return;
        }
        
        if (message.timestamp <= this.uptime_) {
            this.logger_.debug('Discard expired message received: ' +
                               C.lang.reflect.inspect(message));
            return;
        }
        
        this.logger_.debug('Message received: ' + 
                           C.lang.reflect.inspect(message));
        
        dispatch = this.dispatching_[message.id];
        if (!dispatch) {
            this.logger_.warn('Response from ' + message.sender + 
                              ' for request ' + message.id + ' of job ' + 
                              message.job + ' seems timeout. Details: ' +
                              C.lang.reflect.inspect(message));
            return;
        }
        
        dispatch.responses[message.sender] = message;
        
        if (Object.keys(dispatch.responses).length < dispatch.job.nodes.length) {
            this.logger_.debug('Request ' + message.id + ' for job ' + 
                               C.lang.reflect.inspect(dispatch.job) + 
                               ' still wait for responses from targets ' +
                               dispatch.job.nodes.filter(function (node) {
                                   return !(node in dispatch.responses);
                               }));
            return;
        }
        
        // job completed
        clearTimeout(dispatch.timer);
        
        this.logger_.debug('Request ' + message.id + ' for job ' + 
                          C.lang.reflect.inspect(dispatch.job) + 
                          ' complete. Result: ' +
                          C.lang.reflect.inspect(dispatch.responses));
        
        dispatch.callback && dispatch.callback(null, dispatch.responses);
    };
    
    // TODO: stat, tee, cancel
    
    /**
     * Read the orchestration job objects satisfied the criteria
     *
     * @method read
     * @param {Action} action the querying action to be handled
     */
    OrchestrationHandler.prototype.read = function (action) {
        action.acquire('data.orchestration.read', function (error, result) {
            if (error) {
                action.error(error);
                return;
            }
            action.done(result);
        });
    };
    
    C.namespace('caligula.handlers').OrchestrationHandler = OrchestrationHandler;
    
    /**
     * This type of error is to be thrown when the required job can not be
     * found.
     *
     * @class JobNotFoundError
     * @constructor
     * @extends NotFoundError
     * @param {String} message the error message describe this error
     */
    function JobNotFoundError (message) {
        /* inheritance */
        this.super(6, message);
    }
    C.lang.inherit(JobNotFoundError, C.caligula.errors.NotFoundError);

    C.namespace('caligula.errors').JobNotFoundError = JobNotFoundError;
    
    /**
     * This type of error is to be thrown when the specified job can not be
     * cancelled according to its current state.
     *
     * @class JobNotCancelledError
     * @constructor
     * @extends ConflictError
     * @param {String} message the error message describe this error
     */
    function JobNotCancelledError (message) {
        /* inheritance */
        this.super(6, message);
    }
    C.lang.inherit(JobNotCancelledError, C.caligula.errors.ConflictError);

    C.namespace('caligula.errors').JobNotCancelledError = JobNotCancelledError;
    
}, '0.0.1', { requires: ['caligula.handlers.base'] });
