/**
 * This module contains the implementation of the CounterHandler, which is
 * designed to handle the actions about the counters.
 *
 * @module caligula.component.configuration.counter
 */
Condotti.add('caligula.component.configuration.counter', function (C) {
    
    /**
     * This CounterHandler is designed to handle required actions about the
     * counter. A counter is 
     *
     * @class CounterHandler
     * @constructor
     */
    function CounterHandler (config) {
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
            data = null,
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
                new: true
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
