/**
 * This module contains the implementation of the orchestration APIs.
 *
 * @module caligula.components.orchestration.base
 */
Condotti.add('caligula.components.orchestration.base', function (C) {
    
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
            config = null
            self = this;
        
        config = this.config_.kafka;
        config.logger = C.logging.getLogger('Kafka - API');
        
        this.kafka_ = Kafka(this.config_.kafka);
        this.kafka_.on('connect', function () {
            var topic = self.kafka_.topics[self.config_.id];
            
            if (!topic) {
                topic = self.kafka_.topic(self.config_.id, 
                                          self.config_.consumer);
                                          
                topic.on('data', self.onKafkaConsumerData_.bind(self));
                // consumer won't emit error
                // topic.on('error', self.onKafkaConsumerError_.bind(self));
            }
            
            topic.resume();
            self.ready_ = true;
        });
        
        this.kafka_.connect();
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
        
        C.async.waterfall([
            function (next) { // save into the database
                
                if (job.shortcut) {
                    self.logger_.debug('Job is required to be shortcutted.');
                    next(null, null);
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
        
                
                self.dispatch_(job, message, next);
            }
        ], function (error, result) {
            if (error) {
                logger.error(error);
                action.error(error);
                return;
            }
            
            logger.done(result);
            action.done({ id: job.id });
        });
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
    OrchestrationHandler.prototype.dispatch_ = function (job, message, 
                                                         callback) {
        var content = null,
            timer = null,
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
        
        timer = setTimeout(function () {
            self.logger_.warn('Request ' + message.id + ' for job ' + 
                              C.lang.reflect.inspect(job) + 
                              ' timeout. Result: ' +
                              C.lang.reflect.inspect(dispatch.result));
                              
            callback && callback(null, dispatch.result);
            delete self.dispatching_[message.id];
        }, this.config_.timeout);
        
        dispatch = {
            id: message.id,
            job: job,
            timer: timer,
            result: {},
            callback: callback
        };
        
        this.dispatching_[message.id] = dispatch;
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
        
        dispatch.result[message.sender] = message;
        
        if (Object.keys(dispatch.result).length < dispatch.job.nodes.length) {
            this.logger_.debug('Request ' + message.id + ' for job ' + 
                               C.lang.reflect.inspect(dispatch.job) + 
                               ' still wait for responses from targets ' +
                               dispatch.job.nodes.filter(function (node) {
                                   return !(node in dispatch.result);
                               }));
            return;
        }
        
        // job completed
        clearTimeout(dispatch.timer);
        
        this.logger_.debug('Request ' + message.id + ' for job ' + 
                          C.lang.reflect.inspect(dispatch.job) + 
                          ' complete. Result: ' +
                          C.lang.reflect.inspect(dispatch.result));
        
        dispatch.callback && dispatch.callback(null, dispatch.result);
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
    
}, '0.0.1', { requires: ['caligula.handlers.base'] });
