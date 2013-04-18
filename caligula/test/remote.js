var http = require('http');

http.createServer(function (request, response) {
    console.log('New request on ' + request.url);
    var body = JSON.stringify({
            result: {
                message: 'hello from remote server'
            }
        });
    
    response.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': body.length
    });
    
    console.log('Output: ' + body);
    
    response.end(body);
    
}).listen(8081);

console.log('>>> Remote server is running on 8081 now ...');