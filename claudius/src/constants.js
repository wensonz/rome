/**
 * This module contains the definition of the constants and enums used by the
 * group based publishing APIs
 *
 * @module caligula.components.publishing.group.constants
 */
Condotti.add('caligula.components.publishing.group.constants', function (C) {
    
    C.namespace('caligula.publishing.group.constants').State = {
        OK: 0,
        FAIL: 1,
        PROCESSING: 2
    };
    
    C.namespace('caligula.publishing.group.constants').Progress = {
        INITIAL: 0,
        OPERATION_LOG_CREATED: 1,
        GROUP_UPDATED: 2,
        TAG_CREATED: 3,
        DEPLOYMENT_JOB_CREATED: 4,
        COMPLETED: 5
    };
    
}, '0.0.1', { requires: [] });