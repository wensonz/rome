/**
 * This module contains the implementation of the class OrcaApp, which is
 * designed to serve the orchestration request and provides the client side
 * functionalities, such as executing a command, etc.
 *
 * @module caligula.components.orca.app
 */
Condotti.add('caligula.components.orca.app', function (C) {
    
    /**
     * This OrcaApp is a child of the abstract base App, and is designed to
     * serve the orchestration requests and provide the client side
     * functionalities, such as executing a command, etc.
     *
     * @class OrcaApp
     * @constructor
     * @extends App
     * @param {Object} config the config object for this app
     * @param {Contextualizer} contextualizer the contextualizer used to 
     *                                        contextualize the incoming
     *                                        request to an Action instance
     * @param {Router} router the router for routing the action context instance
     *                        to its correct handler and invoke the handler to
     *                        complete the processing of the request
     */
    function OrcaApp (config, contextualizer, router) {
        /* inheritance */
        this.super(config, contextualizer, router);
        
        /**
         * Identifier of this orca client
         * 
         * @property id_
         * @type String
         */
        this.id = this.config_.id;
        
        /**
         * The Kafka client instance
         * 
         * @property kafka_
         * @type Kafka
         * @deafult null
         */
        this.kafka_ = null;
    
        /**
         * The uptime of this client in order to filter out the expired message 
         * received when started up
         * 
         * @property uptime_
         * @type Number
         */
        this.uptime_ = Math.floor(Date.now() / 1000);
    
        /* initialize */
        this.initialize_();
    }
    
    C.lang.inherit(OrcaApp, C.caligula.apps.App);
    
    /**
     * Initialize this handler
     *
     * @method initialize_
     * @param {}  
     * @return {} 
     */
    OrcaApp.prototype.initialize_ = function () {
        var Kafka = require('franz-kafka');
        
        this.logger_.info('Initializing Orca client "' + this.id +
                          '" with config ' + 
                          C.lang.reflect.inspect(this.config_));
        
        this.config_.kafka.logger = C.logging.getLogger('Kafka - ORCA');
        this.kafka_ = Kafka(this.config_.kafka);
        this.kafka_.on('connect', this.onKafkaConnect_.bind(this));
        
        this.logger_.info('Orca client "' + this.id + '" is initialized.');
        this.logger_.info('Uptime (sec): ' + this.uptime_);
    };
    
    /**
     * The "connect" handler for the Kafka client
     *
     * @method onKafkaConnect_
     */
    OrcaApp.prototype.onKafkaConnect_ = function () {
        var topic = null;
    
        this.logger_.debug('Kafka client becomes connected to the servers');
        topic = this.kafka_.topics[this.id];
        if (!topic) { // first time called
            this.logger_.debug('Kafka client connects to the servers first ' +
                               'time');
            
            topic = this.kafka_.topic(this.id, this.config_.consumer);
            topic.on('data', this.onKafkaConsumerData_.bind(this));
            
            // consumer won't emit error
            // topic.on('error', self.onKafkaConsumerError_.bind(self));
            this.logger_.info('Orca is now running.');
        }
        
        // try to call resume again to continue receiving data
        topic.resume();
    };
    
    /**
     * The "data" handler for the Kafka topic
     *
     * @method onKafkaConsumerData_
     * @param {String} data the data received
     */
    OrcaApp.prototype.onKafkaConsumerData_ = function (data) {
        var message = null;
    
        try {
            message = JSON.parse(data);
        } catch (e) {
            this.logger_.error('Malformed JSON message received: ' + data);
            return;
        }
    
        if (message.timestamp <= this.uptime_) {
            this.logger_.debug('Discard expired message received: ' +
                               C.lang.reflect.inspect(message));
            return;
        }
    
        this.logger_.debug('Message received: ' + 
                           C.lang.reflect.inspect(message));
        //
        this.logger_.debug('Contextualizing the incoming request with ' +
                           'command: ' + message.command + ', params: ' + 
                           C.lang.reflect.inspect(message.params));
        
        action = new C.caligula.actions.OrcaAction(
            this.router_, message, this
        );
        
        this.contextualizer_.contextualize(action, function (error) {
            if (error) {
                action.error(error);
                return;
            }
            
            self.logger_.debug('Action ' + action.name + 
                               ' is contextualized successfully. Action: ' +
                               C.lang.reflect.inspect(action));
                               
            self.logger_.debug('Routing the contextualized action ' +
                               action.name + ' ...');
            self.router_.route(action);
        });
        
        /*
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
        */
    };
    
    /**
     * Return the specified topic
     *
     * @method getTopic_
     * @param {String} name the name of the topic to be returned
     * @return {Topic} the topic for the specified name
     */
    OrcaApp.prototype.getTopic_ = function (name) {
        var self = this,
            topic = this.kafka_.topics[name];
            
        if (topic) {
            return topic;
        }
    
        this.logger_.debug('Topic "' + name + '" is initialized first time');
        topic = this.kafka_.topic(name, this.config_.producer);
        topic.on('drain', function () {
            self.logger_.debug('Topic ' + name + ' is writable now');
        }).on('error', function (error) {
            self.logger_.error('Error occurs on the producer of topic "' +
                               name + '". Details: ' +
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
        
        return topic;
    };
    
    
    /**
     * Run this app
     *
     * @method run
     * @param {Function} callback the callback function to be invoked after the
     *                            app has exited successfully, or some error
     *                            occurs. The signature of the callback is
     *                            "function (error) {}"
     */
    OrcaApp.prototype.run = function (callback) {
        this.logger_.info('Starting orca client ' + this.id + ' ...');
        this.kafka_.connect();
    };
    
    C.namespace('caligula.apps').OrcaApp = OrcaApp;
    
}, '0.0.1', { requires: ['caligula.apps.base'] });