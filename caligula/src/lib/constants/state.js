/**
 * This module contains the definition of the unified states
 * 
 * @module caligula.constants.state
 */
Condotti.add('caligula.constants.state', function (C) {

    C.namespace('caligula.constants').State = {
        OK: 0,
        FAIL: 1,
        CHANGING: 2
    };

}, '0.0.1', { requires: [] });