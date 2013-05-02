/**
 * This module contains the implementation of the LockHandler which is deisgned
 * to handle the lock acquiring and releasing action.
 * 
 * @module caligula.components.configuration.lock
 */
Condotti.add('caligula.components.configuration.lock', function (C) {

    var LockState = {
        LOCKED: 1,
        UNLOCKED: 0
    };
    
    /**
     * This LockHandler class is designed to provide the locking service, such
     * as acquire and release a lock.
     * 
     * @class LockHandler
     * @constructor
     * @extends Handler
     */
    function LockHandler() {
        /* inheritance */
        this.super();
    }
    
    C.lang.inherit(LockHandler, C.caligula.handlers.Handler);
    
    /**
     * Acquire a lock. The data structure contained by action.data is like:
     * {
     *     'name': ${name of the lock},
     *     'lease': ${lifespan of the lock in milliseconds from now on}
     * }
     * 
     * @method acquire
     * @param {Action} action the acquiring action to be handled
     */
    LockHandler.prototype.acquire = function (action) {
        var params = null,
            id = null;
        
        params = action.data;
        id = C.uuid.v4(); // the lock owner id
        
        action.data = {
            compare: {
                'name': params.name,
                '$or': [
                    { state: LockState.UNLOCKED }, // unlocked
                    {
                        state: LockState.LOCKED,
                        expire: { '$lt': Date.now() }
                    }
                }
            },
            set: {
                state: LockState.LOCKED,
                expire: Date.now() + params.lease,
                owner: id
            },
            operations: {
                new: true,
                upsert: true
            }
        };
        
        action.acquire('data.lock.cas', function (error, result) {
            if (error) {
                action.error(error);
                return;
            }
            
            if (!result.affected) { // the required lock is being locked now
                action.error(new C.caligula.errors.LockAcquiringFailedError(
                    'Lock ' + params.name + 
                    ' has already been acquired by others'
                ));
                return;
            }
            
            action.done(id);
        });
    };
    
    /**
     * Release a lock. The data structure contained by action.data is like:
     * {
     *     'name': ${name of the lock},
     *     'owner': ${the owner identifier who is supposed to own the lock now}
     * }
     * 
     * @method release
     * @param {Action} action the releasing action to be handled
     */
    LockHandler.prototype.release = function (action) {
        var params = null,
            self = this;
            
        params = action.data;
        action.data = {
            compare: {
                'name': params.name,
                'owner': params.owner
            },
            set: {
                'owner': '',
                'state': LockState.UNLOCKED
            },
            operations: {
                new: true,
                upsert: true
            }
        };
        
        action.acquire('data.lock.cas', function (error, result) {
            if (error) {
                action.error(error);
                return;
            }
            
            if (!result.affected) { // the required lock has been locked by other owner
                                    // because of time out
                self.logger_.debug('Lock ' + params.name + 
                                   ' has been released, or acquired again ' +
                                   'by others. Nothing is to be done.');
            }
            
            action.done();
        });
    };
    
    C.namespace('caligula.handlers').LockHandler = LockHandler;

}, '0.0.1', { requires: ['caligula.handlers.base'] });
