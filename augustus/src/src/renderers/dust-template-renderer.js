var dust = require('dust'),
    util = require('util'),
    log4js = require('log4js'),
    async = require('async'),
    //vm = require('vm'),
    TemplateRenderer = require('./template-renderer.js');

function DustTemplateRenderer(templates, dustHelpers) {
    "use strict";
    /**
     * logger
     *
     * @property logger_
     * @type object
     */
    this.logger = log4js.getLogger('DustTemplateRenderer');
    if (dustHelpers) {
        for (var i = 0; i < dustHelpers.length; i++) {
            var helperName = dustHelpers[i].name;
            //dust.helpers.helperName = vm.runInThisContext('(' + dustHelpers[i].value + ')');
            dust.helpers[helperName] = eval('(' + dustHelpers[i].value + ')');
        };
    };

    // dust.compile() can registe compiled template into "dust", we can use the
    // template through template name later.
    templates.forEach(function (t) {
        eval(dust.compile(t.content, t.name));
    });
}

util.inherits(DustTemplateRenderer, TemplateRenderer);

DustTemplateRenderer.prototype.render = function (template, data, callback) {
    "use strict";
    var self = this;

    dust.configurationProperties = data.properties || {};
    this.logger.debug("Before render, you can check 'dust' object: " + util.inspect(dust, false, 3));
    try {
        dust.render(template, data.data, function (err, out) {
            if (err) {
                callback(err, null);
                return;
            }
            self.logger.debug('Rendered template ' + template + ' successfully.');
            callback(null, out);
        });
    } catch(error) {
        callback(error);
    }
};

module.exports.DustTemplateRenderer = DustTemplateRenderer;
