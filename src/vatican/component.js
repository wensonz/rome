/**
 * This module is the entrance of the component of Configuration Management
 * 
 * @module caligula.components.configuration.component
 */
Condotti.add(
    'caligula.components.data.component', 
    function (C) {}, 
    '0.0.1', 
    { requires: [
        'caligula.components.data.base',
        'caligula.components.data.mongo'
    ] }
);