var express = require('express');
var app = express(),
    reroute = require('express-reroute'),
    log4js = require('log4js');

log4js.configure({
    appenders: [
        { type: "console" }
    ],
    replaceConsole: true
});


global.app = app;

var rewriteTable = [
    { 'from' : '/assets/(?<op>\\w+)', 'to' : '/vatican/assets/${op}' },
];

app.use(reroute(rewriteTable)); // Must be required before router
app.use(express.bodyParser());
app.use(app.router);

require('./index.js');

app.listen(3000);
