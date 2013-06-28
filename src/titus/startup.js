#!/usr/bin/env node

/**
 * Startup module for Orca
 *
 * @module startup
 */

/**
 * The main function
 *
 * @method main
 */
function main () {
    var condotti = require('condotti'),
        natives = require('natives'),
        startstopDaemon = require('start-stop-daemon'),
        C = null,
        logger = null,
        orca = null,
        config = null,
        file = null;
    
    
}


/******************************************************************************
 *                                                                            *
 *                               RUN AS MAIN                                  * 
 *                                                                            *
 *****************************************************************************/
if (require.main === module) {
    main();
}