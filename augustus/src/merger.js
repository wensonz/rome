/**
 * This module contains the default configuration merger implementation.
 * 
 * @module caligula.components.configuration.merger
 */
Condotti.add('caligula.components.configuration.merger', function (C) {
    
    // The C++ plugin version of json merger
    C.namespace('caligula.json.fast').Merger = C.require('fast-json-merger');

}, '0.0.1', { requires: [] });

