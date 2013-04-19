/**
 * This module contains the implementation of the CounterHandler, which is
 * designed to handle the actions about the counters.
 *
 * @module caligula.components.configuration.counter
 */
Condotti.add('caligula.components.configuration.counter', function (C) {
    
    /**
     * This CounterHandler is designed to handle required actions about the
     * counter.
     *
     * @class CounterHandler
     * @constructor
     * @extends Handler
     */
    function CounterHandler () {
        /* inheritance */
        this.super();
    }
    
    C.lang.inherit(CounterHandler, C.caligula.handlers.Handler);

    /**
     * Increase a value onto the counter specified by its name. Note that this
     * method requires the counter to be increased MUST exist, otherwise unknown
     * result is to be returned. When succeeded, the counter object itself is
     * returned in the format:
     *  { name: '${counter name}', value: ${current value} }
     * 
     * @method increase
     * @param {Action} action the increasement action to be handled
     */
    CounterHandler.prototype.increase = function(action) {
        var params = null,
            value = null;
        
        params = action.data;
        value = params.value;
        if (Number !== C.lang.reflect.getObjectType(value)) {
            value = 1;
        }

        action.data = {
            compare: {
                name: params.name
            },
            set: {
                '$inc':  { 'value': value }
            },
            operations: {
                new: true,
                upsert: true
            }
        };
        
        action.acquire('data.counter.cas', function (error, result) {
            if (error) {
                action.error(error);
                return;
            }

            action.done(result);
        });
    };
    
    /**
     * Reset the specified counter
     * 
     * @method reset
     * @param {Action} action the reset action to be handled
     */
    CounterHandler.prototype.reset = function (action) {
        var params = null;
        
        params = action.data;
        action.data = {
            compare: {
                name: params.name
            },
            set: {
                value: 0
            },
            operations: {
                upsert: true
            }
        };
        
        action.acquire('data.counter.cas', function (error, result) {
            if (error) {
                action.error(error);
                return;
            }

            action.done(result);
        });
    };



    C.namespace('caligula.handlers').CounterHandler = CounterHandler;
    
}, '0.0.1', { requires: ['caligula.handlers.base'] });
