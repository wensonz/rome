#!/usr/bin/env node

var io = require('socket.io'),
    http = require('http');
    

io = io.listen(8080);
io.sockets.on('connection', function (socket) {
    socket.on('exec', function (data) {
        console.log('>>> Exec: ');
        console.log('  * stat: ' + data.stat);
        socket.close(function () {
            process.exit(0);
        });
    });
    socket.emit('exec', 'echo "hello world!"');
});

console.log('>>> Server is running ...');