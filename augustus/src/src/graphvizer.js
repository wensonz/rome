var spawn = require('child_process').spawn;
/**
 * generate useful formats diagrams such as image and svg form dot language
 * using graphviz.
 * @method graphviz
 * @param {object} req http request object
 * @param {object} res http response object
 *
 */
function graphviz(req, res) {
    "use strict";
    var outFormat = req.body.format,
        dotInput = req.body.dot,
        dot = spawn('dot', ['-T', 'svg']),
        out = '', code, err, httpCode;

    if ('string' !== typeof outFormat) {
        err = "format should be a string.";
        res.json(415, { "error" : { "code": 1001, "message": err} });
        return;
    }

    if ('string' !== typeof dotInput) {
        err = "dot should be a string";
        res.json(415, { "error" : { "code": 1001, "message": err} });
        return;
    }

    dot.stdout.on('data', function (data) {
        out += data;
    });
    dot.stderr.on('data', function (data) {
        out += data;
    });
    dot.on('exit', function (code) {
        if (0 === code) {
            httpCode = 200;
        } else {
            httpCode = 500;
        }
        res.json(httpCode, {'result': {'out': out}});
    });

    dot.stdin.write(dotInput);
    dot.stdin.end();
}

module.exports = graphviz;
