Condotti.add('caligula.components.configuration.index', function (C) {
    
    function ConfigurationHandler () {
        //
    }
    
    ConfigurationHandler.prototype.default = function (action) {
        action.done({
            'message': 'Hello from ConfigurationHandler'
        });
    };
    
    ConfigurationHandler.prototype.call = ConfigurationHandler.prototype.default;
    
    C.namespace('caligula.handlers').ConfigurationHandler = ConfigurationHandler;
    
}, '0.0.1', { requires: [] });