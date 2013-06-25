/**
 * This module is the entrance of the component "publishing", which is designed
 * to provide group-based APIs for Weibo master site.
 *
 * @module caligula.components.publishing.component
 */
Condotti.add('caligula.components.publishing.component', function (C) {
    //
}, '0.0.1', { requires: [
    'caligula.components.publishing.group',
    'caligula.components.publishing.package',
    'caligula.components.publishing.loadbalancer'
] });