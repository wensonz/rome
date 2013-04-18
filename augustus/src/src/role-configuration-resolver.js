/**
 * This module provides the implementation of the resovler of the configuration
 * objects in roles, which is designed to resolve the conflictions among the
 * configuration container objects in multiple roles during the generation of 
 * the configurations for some host. For more details, please refer to the 
 * description of the class RoleConfigurationResolver below.
 *
 * @module role-configuration-resolver
 */

var util = require('util');
var log4js = require('log4js');

/**
 * Class RoleConfigurationResolver is designed to provide the functionalities 
 * that resolve the conflictions among the configuration container objects in
 * multiple roles some host belongs to during the generation of its
 * configurations. Typically a single host may belong to multiple roles, and
 * each role contains a configuration container object, which consists of 
 * multiple configuration objects for different categories, such as "files"
 * category includes all configuration data associated with configuration 
 * files, while "packages" means the packages should be installed on the host
 * in order to provide some kind of service, etc. In order to resolve the 
 * conflictions among these configuration objects, priority is involved. The
 * configuration item with higher priority will finally win the game.
 *
 * @class RoleConfigurationResolver
 * @constructor
 */
function RoleConfigurationResolver() {
    "use strict";
    
    /**
     * logger
     *
     * @property logger_
     * @type Logger
     */
    this.logger_ = log4js.getLogger('RoleConfigurationResolver');
    
}

/**
 * TODO: description here
 *
 * @method resolve
 * @param {Array} names the array of role names to be resolved
 * @param {Object} roles the collection of roles
 * @return {Object} the result object is supposed to contain two elements, 
 *                  "configuration" contains all the resolved configuration
 *                  data, while "shema" keeps the source where each item of
 *                  the configuration comes from.
 */
RoleConfigurationResolver.prototype.resolve = function(node, roles) {
    // find out all roles involved based on the passed-in names
    var includes = null,
        configuration = {},
        self = this,
        level = 0,
        result = {
            'configuration': {},
            'includes': []
        };
    
    if (!node.includes || 0 === node.includes) {
        this.logger_.warn('Node ' + node.name + ' does not belong to any role');
        return {};
    }
    
    includes = this.calculate_(node, roles);
    this.logger_.debug('Calculated inclusion list for node ' + node.name + 
                       ' is: ' + util.inspect(includes, false, null));
    
    level = includes[0].level; // max level
    includes.forEach(function (included) {
        try {
            result.includes.push(included.role);
            self.resolveRole_(roles[included.role], included.level, 
                              configuration, level);
        } catch (e) {
            throw new ResolveRoleFailedError(included.role, e);
        }
    });
    
    result.configuration = configuration;
    return result;
};

/**
 * Return the type of the passed in object. Usually the result is the 
 * function which constructs it. 'undefined' and 'null' are both supported.
 *
 * @method getObjectType_
 * @param {Object} object the object whose type will be returned
 * @return {Function} the type of the object. If the passed in object is
 *                    undefined, then undefined is returned, or if the 
 *                    object is null, then Object is returned.
 */
RoleConfigurationResolver.prototype.getObjectType_ = function (object) {
    if (undefined === object) {
        return undefined;
    } else if (null === object) {
        return Object;
    }
        
    return object.constructor;
};


/**
 * Return the function name. If it is an anonymous function, 'anonymous'
 * is returned.
 *
 * @method getFunctionName
 * @param {Function} func the function whose name is to be returned
 * @return {String} name of the function. If the name could not be found, 
 *                  'anonymous' is returned.
 */
RoleConfigurationResolver.prototype.getFunctionName_ = function (func) {
    if (undefined === func) {
        return 'Undefined';
    } else if (null === func) {
        return 'Null';
    }
    return func.name || 
           func.toString().match(/function\s*([^(]*)\s*\([^)]*\)/)[1] ||
           'anonymous';
};

/**
 * Return if the passed in param is a plain object that is created via "{}"
 * or "new Object". Forked from jquery.
 *
 * @method isPlainObject
 * @param {Object} object the object to be tested
 * @return {Boolean} true if the object is a plain object, otherwise false
 *                   is returned.
 */
RoleConfigurationResolver.prototype.isPlainObject_ = function (object) {
    var key = null;
        
    if (!object || this.getObjectType_(object) !== Object) {
        return false;
    }
        
    try {
        if (object.constructor && 
            !Object.prototype.hasOwnProperty.call(object, 'constructor') &&
            !Object.prototype.hasOwnProperty.call(
                object.constructor.prototype, 'isPrototypeOf'
            )) {
            return false;
        }
    } catch (e) {
        return false;
    }
        
    for (key in object) {}
        
    return key === undefined || 
           Object.prototype.hasOwnProperty.call(object, key);
};

/**
 * Resolve the configuration in the passed-in role with the passed-in configuration.
 * The result data is saved in the passed-in configuration object.
 *
 * @method resolveRole_
 * @param {Object} role the role whose configuration is to be resolved
 * @param {Object} configuration the configuration object with the result data
 */
RoleConfigurationResolver.prototype.resolveRole_ = function(role, rlevel, configuration, clevel) {
    var path = [];
    this.resolveObject_(path, configuration, clevel, role.configuration, rlevel, false);
};

/**
 * Merge one object B into the other one A. All keys belong to B only are to be
 * inserted into object A. The left keys, which indicate the conflictions, are
 * further merged according to the type of the value, for example, if the type
 * of the value is Array, mergeArray_ is used.
 *
 * @method resolveObject_
 * @param {Array} path the path to the object 'to' and 'from'
 * @param {Object} to the object to be merged to
 * @param {Object} from the object to be merged from
 * @return {Object} the resolve schema
 */
RoleConfigurationResolver.prototype.resolveObject_ = function (path, to, tlevel, from, flevel, inArray) {
    var key = null,
        value = null;
    
    for (key in from) {
        if (from.hasOwnProperty(key)) {
            
            if (inArray && (-1 !== ['name', 'index'].indexOf(key))) {
                continue;
            }
            
            path.push(key);
            
            if (key in to) {
                if (this.getObjectType_(from[key]) === 
                    this.getObjectType_(to[key])) {
                
                    if (this.isPlainObject_(from[key])) {
                        this.logger_.debug('Resolving object on path ' + 
                                           path.join('.'));
                    
                        this.resolveObject_(path, to[key], tlevel, from[key], 
                                            flevel, false);
                        path.pop();
                        continue;
                    } else if (Array.isArray(from[key])) {
                        this.logger_.debug('Resolving array on path ' + 
                                           path.join('.'));
                        this.logger_.debug('From object: ' + util.inspect(from, false, null));
                        this.logger_.debug('To object: ' + util.inspect(to, false, null));
                        this.resolveArray_(path, to[key], tlevel, from[key], 
                                           flevel);
                        path.pop();
                        continue;
                    }
                }
                
                if (tlevel <= flevel) { // 'to' object has a higher priority than 'from' object
                    throw new HigherPriorityOverwrittenError(path.join('.'), 
                                                             tlevel, flevel);
                }
            }
            
            
            this.logger_.debug('Add nonexist \'' + key + 
                               '\' to the config object of path: ' + 
                               path.join('.'));
            to[key] = JSON.parse(JSON.stringify(from[key]));
            path.pop();
        }
    }
};

/**
 * Merge two arrays, from A to B. Conflictions are detected if two elements in A
 * and B both contain a field "name" and a same value. Those elements from A, 
 * which do not conflict with any one in B, are to be appended to B. For those
 * elements which contain a field "index" and an integer value in either array,
 * they are to be placed at the position "index" indicates in the new resolved
 * array. If there were two elements with the same index, an error will be thrown
 *
 * @method resolveArray_
 * @param {Array} to the array to be resolved to
 * @param {Array} from the array to be resolved from
 */
RoleConfigurationResolver.prototype.resolveArray_ = function (path, to, tlevel, from, flevel) {
    var conflict = {},
        key = null,
        value = null,
        self = this,
        result = [];
    
    if (0 === from.length) {
        this.logger_.warn('The array param to be resolved from [path: ' + 
                          path.join('.') + '] is empty');
        return;
    }
    if (0 === to.length) {
        this.logger_.warn('The array param to be resolved to [path: ' + 
                          path.join('.') + '] is empty');
        // TODO: assign 'from' to 'to' directly via passing in the parent object of 'to'?
        Array.prototype.splice.apply(to, [0, 0].concat(from));
        return;
    }
    
    if (!this.isPlainObject_(from[0])) {
        if (tlevel <= flevel) {
            throw new HigherPriorityOverwrittenError(path.join('.'), tlevel, flevel);
        }
        this.logger_.debug('Content type of the elements of the array `from` is ' +
                           this.getFunctionName_(this.getObjectType_(from[0])) + 
                           ', but not plain object. `to` array is to be overwritten.');
        Array.prototype.splice.apply(to, [0, to.length].concat(from));
        return;
    }
    
    if (!this.isPlainObject_(to[0])) {
        if (tlevel <= flevel) {
            throw new HigherPriorityOverwrittenError(path.join('.'), tlevel, flevel);
        }
        this.logger_.debug('Content type of the elements of the array `to` is ' +
                           this.getFunctionName_(this.getObjectType_(to[0])) + 
                           ', but not plain object. `to` array is to be overwritten.');
        Array.prototype.splice.apply(to, [0, to.length].concat(from));
        return;
    }
    
    to.forEach(function (item) {
        if ('name' in item) {
            conflict[item.name] = item;
        }
    });
    
    from.forEach(function (item, index) {
        if (('name' in item) && (item.name in conflict)) {
            path.push(index.toString());
            self.resolveObject_(path, conflict[item.name], tlevel, item, flevel, true);
            path.pop();
        } else {
            to.push(item);
        }
    });
    
    to.forEach(function (item, index) {
        if ('index' in item)  {
            if (result[item.index]) {
                if ('index' in result[item.index]) { // some item has taken this slot via "index" field
                    throw new IndexConflictionError(path.join('.'), item.index);
                } else { // current item at "index" is just by position, not specified by "index" field
                    result.splice(item.index, 0, item);
                }
            } else { // the "index" is not taken
                result[item.index] = item;
            }
        }
    });
    
};


/**
 * Calculate the prioritized list of roles a node includes, which is used
 * when resolving the configurations among different roles.
 *
 * @method calculate_
 * @param {Object} node the node whose configuration is to be resolved
 * @param {Object} roles the collection of roles
 * @return {Array} the calculated array of role names, which keeps the order when merging
 */
RoleConfigurationResolver.prototype.calculate_ = function(node, roles) {
    var trace = {},
        unique = {},
        calculated = [],
        self = this;
        
    roles[node.name] = { 'name': node.name, 'includes': node.includes };
    this.logger_.debug('Role candidates: ' + util.inspect(roles, false, null));
    /**
     * some day maybe we have to convert the recursive calls to 
     * iterative calls
     */
    (function (current, level) {
        var includes = null,
            length = 0,
            index = 0;
        
        self.logger_.debug('Calculating role: ' + current + ', level: ' + level);
        if (current in trace) {
            self.logger_.debug('Role ' + current + ' is circular included by node ' + node.name);
            throw new CircularInclusionError(node.name, current);
        }
        
        if (!(current in roles)) {
            self.logger_.debug('Role ' + current + ' can not be found');
            throw new RoleNotFoundError(current);
        }
        
        trace[current] = true;
        
        includes = roles[current].includes || [];
        self.logger_.debug('Inclusion of role ' + current + ' is: ' + util.inspect(includes, false, null));
        length = includes.length;
        for (index = 0; index < length; index += 1) {
            self.logger_.debug('Going to resolve role ' + includes[index]);
            arguments.callee(includes[index], level + 1);
        }
        
        delete trace[current];
        if (!(current in unique)) {
            unique[current] = calculated.push({
                role: current,
                level: level
            }) - 1;
        } else {
            calculated[unique[current]].level = Math.max(calculated[unique[current]].level, level);
        }
    })(node.name, 0);
    
    delete roles[node.name]; // remove the mock node role data from roles
    calculated.pop(); // remove the node name from calculated
    
    calculated.sort(function (a, b) { return b.level - a.level; });
    return calculated;
};


/**
 * CircularInclusionError
 *
 * @class CircularInclusionError
 * @constructor
 * @extends Error
 * @param {String} node the node name whose configuration is to be resolved
 * @param {String} role the role name which is circular included
 */
function CircularInclusionError(node, role) {
    "use strict";
    this.message = 'Role ' + role + ' is circular included by node ' + node;
    this.name = 'CircularInclusionError';
}

util.inherits(CircularInclusionError, Error);

/**
 * RoleNotFoundError
 *
 * @class RoleNotFoundError
 * @constructor
 * @param {String} role the role name which can not be found
 */
function RoleNotFoundError(role) {
    "use strict";
    this.message = 'Role ' + role + ' can not be found';
    this.name = 'RoleNotFoundError';
}

util.inherits(RoleNotFoundError, Error);


/**
 * IndexConflictionError
 *
 * @class IndexConflictionError
 * @constructor
 * @extends Error
 * @param {String} path the path to the arrays where confliction is found
 * @param {Number} index the index where confliction is detected
 */
function IndexConflictionError(path, index) {
    "use strict";
    this.message = 'Confliction is detected at index ' + index.toString() + 
                   ' when resolving arrays at path ' + path;
    this.name = 'IndexConflictionError';
}

util.inherits(IndexConflictionError, Error);

/**
 * HigherPriorityOverwrittenError
 *
 * @class HigherPriorityOverwrittenError
 * @constructor
 * @extends Error
 * @param {String} path the path to where the error occurs
 * @param {Number} highLevel the higher level to be overwritten
 * @param {Number} lowLevel the lower level to overwrite the higher one
 */
function HigherPriorityOverwrittenError(path, highLevel, lowLevel) {
    this.message = 'Configuration with lower priority ' + lowLevel + 
                   ' at path ' + path + ' tries to overwrite the one with' +
                   ' higher priority ' + highLevel;
    this.name = 'HigherPriorityOverwrittenError';
}

util.inherits(HigherPriorityOverwrittenError, Error);

/**
 * ResolveRoleFailedError
 *
 * @class ResolveRoleFailedError
 * @constructor
 * @extends Error
 * @param {String} role the role name which is failed to be resolved
 * @param {Error} reason the error caused the failure
 */
function ResolveRoleFailedError(role, reason) {
    this.message = 'Resolving role ' + role + ' failed. Error: ' + util.inspect(reason);
    this.name = 'ResolveRoleFailedError';
}

util.inherits(ResolveRoleFailedError, Error);

module.exports.RoleConfigurationResolver = RoleConfigurationResolver;
module.exports.CircularInclusionError = CircularInclusionError;
module.exports.RoleNotFoundError = RoleNotFoundError;
module.exports.IndexConflictionError = IndexConflictionError;
module.exports.HigherPriorityOverwrittenError = HigherPriorityOverwrittenError;
module.exports.ResolveRoleFailedError = ResolveRoleFailedError;
