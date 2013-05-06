/**
 * This module is the entrance of the component of Configuration Management
 * 
 * @module caligula.components.configuration.component
 */
Condotti.add(
    'caligula.components.configuration.component', 
    function (C) {}, 
    '0.0.1', 
    { requires: [
        'caligula.components.configuration.base',
        'caligula.components.configuration.counter',
        'caligula.components.configuration.generator',
        'caligula.components.configuration.lock',
        'caligula.components.configuration.merger',
        'caligula.components.configuration.tag'
    ] }
);