/**
 * This module contains the logging utilities, such as the StepLogger etc.
 * 
 * @module caligula.utils.logging
 */
Condotti.add('caligula.logging', function (C) {

    /**
     * This StepLogger class is designed as a helper, and provides the facility
     * to log the begin, end of a step with the specified message. If the step
     * ends with an error, the logger is to log the error details. On the other
     * hand, if the step succeeds, it will log down the result too.
     * 
     * @class StepLogger
     * @constructor
     * @param {Logger} logger the logger instance used to complete the logging
     */
    function StepLogger (logger) {
        /**
         * The message used to construct the log
         * 
         * @property message_
         * @type String
         * @default ''
         */
        this.message_ = '';
        
        /**
         * The logger instance to complete the logging functionality
         * 
         * @property logger_
         * @type Logger
         */
        this.logger_ = logger;
    }
    
    /**
     * Log the begin of a step with the specified message
     * 
     * @method start
     * @param {String} message the descriptive message about the step
     */
    StepLogger.prototype.start = function (message) {
        this.message_ = message;
        this.logger_.debug(message + ' ...');
    };
    
    /**
     * Log the end of a successful step with the result.
     * 
     * @method done
     * @param {Object} result the result of the successful step. It can be null
     *                        or undefined.
     */
    StepLogger.prototype.done = function (result) {
        var message = this.message_ + ' succeed.';
        if (result) {
            message += ' Result: ' + C.lang.reflect.inspect(result);
        }
        
        this.logger_.debug(message);
    };
    
    /**
     * Log the end of a failed step with the passed-in error
     * 
     * @method error
     * @param {Error} error the error causes this step fail
     */
    StepLogger.prototype.error = function (error) {
        this.logger_.error(this.message_ + ' failed. Error: ' + 
                           C.lang.reflect.inspect(error));
    };
    
    C.namespace('caligula.logging').StepLogger = StepLogger;
    
    C.namespace('caligula.logging').getStepLogger = function (logger) {
        return new StepLogger(logger);
    };

}, '0.0.1', { requires: [] });