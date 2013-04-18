function ConfigurationWriter() {
    "use strict";
}

ConfigurationWriter.prototype.write = function (content, context, callback) {
    "use strict";
    callback(new Error('Not implemented'));
};

module.exports = ConfigurationWriter;
