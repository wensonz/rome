
function TemplateRenderer() {
    //
}

TemplateRenderer.prototype.render = function (template, data, callback) {
    callback(new Error('Not implemented'));
}

module.exports = TemplateRenderer;
