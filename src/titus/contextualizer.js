/**
 * This module contains the implementation of the contextualizer used for Orca
 *
 * @module caligula.components.orca.contextualizer
 */
Condotti.add('caligula.components.orca.contextualizer', function (C) {
    
    /**
     * This OrcaContextualizer is a child of the abstract base class
     * Contextualizer, and is designed to contextualize the incoming
     * orchestration request into OrcaAction
     *
     * @class OrcaContextualizer
     * @constructor
     * @extends Contextualizer
     */
    function OrcaContextualizer () {
        /* inheritance */
        this.super();
    }
    
    C.lang.inherit(OrcaContextualizer, C.caligula.contextualizers.Contextualizer);
    
    /**
     * The running job collection
     * 
     * @property running_
     * @type Object
     * @deafult {}
     */
    OrcaContextualizer.running_ = {};
    
    /**
     * Contextualize the incoming request and related data into the passed-in
     * action object appropriately to complete the further processing.
     *
     * @method contextualize
     * @param {Action} action the action object to be contextualized into
     * @param {Function} callback the callback function to be invoked after the
     *                            action context has been successfully
     *                            contextualized, or some error occurs. The 
     *                            signature of the callback is 
     *                            'function (error) {}'
     */
    OrcaContextualizer.prototype.contextualize = function (action, callback) {
        action.id = action.message_.id;
        action.job = action.message_.job;
        action.sender = action.message_.sender;
        action.name = action.message_.command.toLowerCase();
        action.data = action.message_.params;
        action.running = OrcaContextualizer.running_;
        callback();
    };
    
    C.namespace('caligula.contextualizers').OrcaContextualizer = OrcaContextualizer;
    
}, '0.0.1', { requires: ['caligula.contextualizers.base'] });