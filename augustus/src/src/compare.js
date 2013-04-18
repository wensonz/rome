var log4js = require('log4js'),
    async = require('async');

/**
 * Class compare check value 
 *
 * @class Compare
 * @constructor
*/
function Compare() {
    'use strict';

    /**
     * The logger object
     *
     * @property logger_
     * @type Logger
     */
    this.logger_ = log4js.getLogger('Compare');
}

/**
 * Return the result of the non-passed in body. Usually the result is the 
 * string which constructs it. 'null' is supported. Params Validator handler.
 * 
 * @param {object} body body from request body
 * @param {object} data data from parameters
 */
Compare.prototype.paramValidate_ = function (body, data) {
    'use strict';
    var key, length, result = null;

    if (body && data) {
        for (key in data) {
            if (data.hasOwnProperty(key)) {
                if (body.hasOwnProperty(key) || !data[key].optional) {
                    if (!body.hasOwnProperty(key) ||
                            typeof body[key] !== data[key].type) {
                        result = 'Bad record structure: ' + key +
                                 ' should be a ' + data[key].type;
                        return result;
                    }

                    if (typeof body[key] !== "number") {
                        length = body[key].length;
                    } else {
                        length = body[key];
                    }

                    if (data[key].limit !== null &&
                            length > data[key].limit) {
                        result = 'Post data too large. ' + key +
                                 ' limit: ' + data[key].limit;
                        return result;
                    }
                }
            }
        }
    }
    return null;
};

module.exports.Compare = Compare
