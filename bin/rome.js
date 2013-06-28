#!/usr/bin/env node

/**
 * This module contains the implementation of the HTTP API server for project
 * ROME.
 * 
 * @module rome
 */
var natives = require('natives');

/**
 * The main function
 *
 * @method main
 */
function main() {
    var startStopDaemon = require('start-stop-daemon'),
        path = null,
        config = null;
    //
    try {
        // config.json is expected to be a link to rome.json for API server
        // and orca.json for client
        path = natives.path.resolve(__dirname, '../config/config.json');
        config = require(path);
    } catch (e) {
        process.stderr.write('Loading config from file ' + path + 
                             ' failed. Error: ' + e.toString());
        process.exit(1);
        return;
    }
    
    config.daemon = config.daemon || {
        outFile: '/data1/rome/server/logs/out.log',
        errFile: '/data1/rome/server/logs/err.log',
        max: '10',
        pidFile: '/data1/rome/server/rome.pid'
    };
    
    startStopDaemon(config.daemon, run.bind(null, config))
    .on('restart', function () {
        this.stdout.write('>>> ROME server is restarted at ' + Date.now() + 
                          '\n');
    });
}

/**
 * The worker function to run this rome server
 *
 * @method run
 * @param {Object} config the config object for this rome server
 */
function run (config) {
    var condotti = require('condotti'),
        loader = null,
        components = null,
        C = null;
    
    // merge the default configuration for loader
    config.condotti.loader = config.condotti.loader || {};
    loader = config.condotti.loader;
    loader.paths = loader.paths || {};
    loader.paths.caligula = loader.paths.caligula || natives.path.resolve(
        __dirname, '../src/caligula'
    );
    loader.paths['caligula.components'] = loader.paths['caligula.components'] ||
                                          natives.path.resolve(__dirname,
                                                               '../src');
    // merge config for component loader
    components = loader.paths.caligula.components;
    config.dotti['component-loader'].params['0'].value.root = components;
    
    // initialize Condotti instance
    C = condotti.Condotti(config.condotti);
    C.use(config.modules, function (error, unused) {
        var factory = null,
            logger = null,
            loader = null;
            
        if (error) {
            process.stderr.write('Loading modules' + config.modules.toString() +
                                 'failed. Error: ' + error.toString());
            // TODO: exit code handling
            process.exit(1);
            return;
        }
        
        logger = C.logging.getLogger('ROME');
        
        logger.info('Initializing internal components ...');
        factory = new C.di.DottiFactory(config.dotti);
        
        loader = factory.get('component-loader');
        loader.loadAll(function (error) {
            var app = null;
            
            if (error) {
                logger.error('Loading components failed. Error: ' + 
                             error.toString());
                process.exit(1);
                return;
            }
            
            app = factory.get('app');
            // TODO: callback handling when app stopped
            app.run();
        });
    });
}

if (require.main === module) {
    main();
}