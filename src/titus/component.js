/**
 * The entrance module for the orca, orchestration client agent
 *
 * @module caligula.components.orca.component
 */
Condotti.add('caligula.components.orca.component', function (C) {
    //
}, '0.0.1', { requires: [
    'caligula.components.orca.action',
    'caligula.components.orca.app',
    'caligula.components.orca.contextualizer',
    'caligula.components.orca.handler'
] });