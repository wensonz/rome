/**
 * This module contains the implementation of the CliContextualizer class, 
 * which is the child class of its abstract base Contextualizer, and is used to 
 * contextualize the incoming command line request into an CliAction instance.
 *
 * @module caligula.contextualizers.cli
 */
Condotti.add('caligula.contextualizers.cli', function (C) {
    
    /**
     * This CliContextualizer class is the child class of its abstract base
     * Contextualizer, and is designed to process the incoming command line
     * request, and add contextualized data into the passed-in CliiAction object
     * based on the command line arguments in order to complete the following 
     * processing.
     *
     * @class CliContextualizer
     * @constructor
     */
    function CliContextualizer () {
        /* inheritance */
        this.super();
    }
    
    C.lang.inherit(CliContextualizer, 
                   C.caligula.contextualizers.Contextualizer);
    
    /**
     * Parse the command line arguments into two part, an array of the commands
     * and an object of the parsed options. To illustrate what is command and
     * option, following example please find:
     * 
     * node main.js copy file -s /path/to/source/file -d /path/to/dest/file
     * 
     * here "copy" and "file" are commands, since they come directly after the
     * main script and also don't start with "-" which indicate it is an option.
     * The left part, which is supposed to be options, are parsed like what
     * "getopt" does in C.
     * 
     * @method parseCommandLineArguments_
     * @param {Array} argv the command line arguments
     * @param {Array} commands the array used to keep the parsed commands
     * @param {Object} options the parsed options
     */
    CliContextualizer.prototype.parseCommandLineArguments_ = function (argv,
                                                                       commands, 
                                                                       options) {
        var index = 2,
            length = argv.length,
            token = null;
        
        while (index < length) {
            token = argv[index].trim();
            if (token.search(/^-/) >= 0) {
                break;
            }
            
            commands.push(token);
            index += 1;
        }
        
        while (index < length) {
            token = argv[index].trim();
            if (token.length < 2) {
                throw new SyntaxError('An option is expected to be at least' +
                                      ' 2 chars, but "' + token + '" is found.');
            }
            
            if (token[0] !== '-') {
                throw new SyntaxError('An option is expected to start ' +
                                      'with "-", but "' + token + '" is not.');
            }
            
            if (token[1] !== '-') {
                index = this.parseShortOption_(argv, index, options);
            } else if ((token.length > 2) && (token[2] !== '-')) {
                index = this.parseLongOption_(argv, index, options);
            } else {
                throw new SyntaxError('An option is expected to start with ' +
                                      'at most "--", but "' + token + 
                                      '" is found.');
            }
        }
    };
    
    /**
     * Parse a short option
     * 
     * @method parseShortOption_
     * @param {Array} argv the array of the command line arguments
     * @param {Number} index the index of the argument to start with
     * @param {Object} options the option collection used to save the parsed
     *                         option
     * @return {Number} the index of the argument where the parsing stops
     */
    CliContextualizer.prototype.parseShortOption_ = function (argv, index, options) {
        var token = null,
            name = null,
            length = argv.length;
        
        // TODO: add logging
        
        token = argv[index].trim();
        name = token.substring(1);
        index += 1;
        
        while (index < length) {
            
            token = argv[index].trim();
            if (token.search(/^-/) >= 0) {
                break;
            }
            
            if (options.hasOwnProperty(name)) {
                if (Array.isArray(options[name])) {
                    options.push(token);
                } else {
                    options[name] = [options[name], token];
                }
            } else {
                options[name] = token;
            }
            
            index += 1;
        }
        
        if (!options.hasOwnProperty(name)) { // a boolean option
            options[name] = true;
        }
        
        return index;
    };
    
    
    /**
     * Parse a long option
     * 
     * @method parseLongOption_
     * @param {Array} argv the array of the command line arguments
     * @param {Number} index the index of the argument to start with
     * @param {Object} options the option collection used to save the parsed
     *                         option
     * @return {Number} the index of the argument where the parsing stops
     */
    CliContextualizer.prototype.parseLongOption_ = function (argv, index, options) {
        var token = null,
            name = null,
            length = argv.length,
            tokens = null;
        
        // TODO: add logging here
        
        token = argv[index].trim();
        name = token.substring(2);
        index += 1;
        
        tokens = name.split('=');
        if (tokens.length > 1) { // --key=value
            options[tokens[0]] = tokens.slice(1).join('=');
            return index;
        }
        
        while (index < length) {
            
            token = argv[index].trim();
            if (token.search(/^-/) >= 0) {
                break;
            }
            
            if (options.hasOwnProperty(name)) {
                if (Array.isArray(options[name])) {
                    options.push(token);
                } else {
                    options[name] = [options[name], token];
                }
            } else {
                options[name] = token;
            }
            
            index += 1;
        }
        
        if (!options.hasOwnProperty(name)) { // a boolean option
            options[name] = true;
        }
        
        return index;
    };
    
    /**
     * Contextualize the incoming command line arguments, the process 
     * environment and other related data into the passed-in action object 
     * appropiately to complete the further processing.
     *
     * @method contextualize
     * @param {CliAction} action the action object to be contextualized into
     * @param {Function} callback the callback function to be invoked after the
     *                            action context has been successfully
     *                            contextualized, or some error occurs. The 
     *                            signature of the callback is 
     *                            'function (error) {}'
     */
    CliContextualizer.prototype.contextualize = function (action, callback) {
        var options = {},
            commands = [],
            message = null;
        
        // parsing command line arguments
        try {
            this.parseCommandLineArguments_(C.process.argv, commands, options);
        } catch (e) {
            message = 'Parsing command line arguments ' + 
                      C.process.argv.toString() + 
                      ' failed. Error: ' + e.message;
                      
            this.logger_.debug(message);
            callback(new C.caligula.errors.InvalidArgumentError(message));
            return;
        }
        
        action.name = commands.join('.');
        action.data = options;
        // TODO: add environment variables
        
        callback();
    };
    
    /**
     * Decontextualize the action object to an array of params which can be used
     * to spawn another command
     *
     * @method decontextualize
     * @param {Action} action the action object to be decontextualized
     * @param {Function} callback the callback function to be invoked when the
     *                            action object has been successfully 
     *                            decontextualized, or some error occurs. The
     *                            signature of the callback is
     *                            'function (error, data) {}'
     */
    CliContextualizer.prototype.decontextualize = function (action, callback) {
        // TODO: clarify the use case
        callback(null, []);
    };
    
    
    C.namespace('caligula.contextualizers').CliContextualizer = CliContextualizer;
    
}, '0.0.1', { requires: ['caligula.contextualizers.base', 
                         'caligula.errors.cli'] });