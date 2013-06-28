/**
 * description here
 *
 * @module caligula.component.loaders.local
 */
Condotti.add('caligula.component.loaders.local', function (C) {
    
    /**
     * description here
     *
     * @class LocalComponentLoader
     * @constructor
     * @extends 
     * @param {Object} config the config for this component loader
     * @param {DottiFactory} factory the dotti factory used to create objects
     */
    function LocalComponentLoader (config, factory) {
        /**
         * The config object for this loader
         * 
         * @property config_
         * @type Object
         * @default {}
         */
        this.config_ = config || {};
        
        /**
         * The dotti factory used to create objects
         * 
         * @property factory_
         * @type DottiFactory
         */
        this.factory_ = factory;
        
        /**
         * The namespace which the components to be loaded are supposed to be
         * in
         * 
         * @property namespace_
         * @type String
         * @deafult 'caligula.components'
         */
        this.namespace_ = this.config_.namespace || 'caligula.components';
        
        /**
         * The root directory where the components are searched from
         * 
         * @property root_
         * @type String
         * @deafult './'
         */
        this.root_ = this.config_.root || './components';
        
        /**
         * The components found under the root directory
         * 
         * @property components_
         * @type Object
         * @deafult {}
         */
        this.components_ = {};
        
        /**
         * The logger instance for this loader
         *
         * @property logger_
         * @type Logger
         */
        this.logger_ = C.logging.getObjectLogger(this);
        
        /* initialize */
        // this.initialize_();
    }
    
    /**
     * Initialize this component loader
     *
     * @method initialize_
     */
    LocalComponentLoader.prototype.initialize_ = function () {
        var self = this;
        
        // this.root_ = C.natives.path.resolve(this.root_);
        try {
            /*
            C.natives.fs.readdirSync(this.root_).forEach(function (name) {
                var path = C.natives.path.resolve(self.root_, name);
                if (C.natives.fs.statSync(path).isDirectory()) {
                    self.components_[name] = path;
                }
            });
            this.config_.components = this.config_.components || {};
            Object.keys(this.config_.components).forEach(function (name) {
                self.components_[name] = C.natives.path.resolve(
                    self.root_, self.config_.components[name]);
            });
            */
        } catch (e) {
            this.logger_.debug('Normalizing components ' + 
                               C.lang.reflect.inspect(this.config_.components) +
                               ' under ' + this.root_ + 
                               ' failed. Error: ' + C.lang.reflect.inspect(e));
            throw e;
        }
    };
    
    /**
     * Load all components under the root directory
     *
     * @method loadAll
     * @param {Function} callback the callback function to be invoked when the
     *                            specified component has been successfully
     *                            loaded, or some error occurs. The signature of
     *                            the callback is 'function (error) {}'
     */
    LocalComponentLoader.prototype.loadAll = function (callback) {
        C.async.forEachSeries(Object.keys(this.components_), 
                              this.load.bind(this), callback);
    };
    
    /**
     * Load a specified component under the root directory
     *
     * @method load
     * @param {String} name the name of the component which can be located under
     *                      the root directory as a subdirectory with that name
     * @param {Function} callback the callback function to be invoked when the
     *                            specified component has been successfully
     *                            loaded, or some error occurs. The signature of
     *                            the callback is 'function (error) {}'
     */
    LocalComponentLoader.prototype.load = function (name, callback) {
        var path = this.components_[name],
            json = null,
            config = null,
            paths = null;
        
        // TODO: verify if the name exists
        json = C.natives.path.resolve(this.root_, path, 'component.json');
        config = C.require(json);
        
        /* merge the dotti and routing into correct position */
        this.factory_.configure(config);
        
        // A trick to update the path mapping of the loader
        paths = {};
        paths[this.namespace_ + '.' + name] = C.natives.path.resolve(this.root_, 
                                                                     path);
        C.loader_.configure({ paths: paths });
        // TODO: verify if component.js exists
        C.use(this.namespace_ + '.' + name + '.component', callback);
    };
    
    C.namespace('caligula.component.loaders').LocalComponentLoader = LocalComponentLoader;
    
}, '0.0.1', { requires: [] });