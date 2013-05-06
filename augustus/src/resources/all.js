/**
 * This module is designed to be the facade of all resource processors.
 * 
 * @module caligula.components.configuration.resources.all
 */
Condotti.add(
    'caligula.components.configuration.resources.all', 
    function (C) {},
    '0.0.1',
    { requires: [
        'caligula.components.configuration.resources.base',
        'caligula.components.configuration.resources.file',
        'caligula.components.configuration.resources.template'
    ] }
);