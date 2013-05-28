/**
 * This module contains the implementation of the multipart middleware for 
 * connect framework.
 *
 * @module caligula.components.file.multipart
 */
Condotti.add('caligula.components.file.multipart', function (C) {
    
    function multipart (config) {
        
        var directory = null,
            logger = C.logging.getFunctionLogger(multipart),
            formidable = C.require('formidable');
        
        config = config || {};
        directory = config.directory || '/data1/rome/temp/';
        
        return function (request, response, next) {
            
            var type = request.headers['content-type'],
                form = null,
                message = null,
                content = null,
                body = null;
            
            logger.debug('Getting content type of incoming request: ' + 
                         C.lang.reflect.inspect(type));
            
            if (!type || (type !== 'application/multipart')) {
                logger.debug('Incoming request is not multi-parted, going to ' +
                             'next middleware');
                next();
                return;
            }
            
            logger.debug('Initializing new formidable.IncomingForm with ' +
                         'uploadDir: ' + directory);
                         
            form = new formidable.IncomingForm();
            form.uploadDir = directory;
            form.maxFieldsSize = 100 * 1024 * 1024; // 100MB
            form.maxFields = 0; // unlimited
            form.hash = 'md5'; // calculate md5 automatically
            
            message = 'Parsing the incoming request');
            logger.debug(message + ' ...');
            form.parse(request, function (error, fields, files) {
                if (error) {
                    logger.error(message + ' failed. Error: ' + 
                                 C.lang.reflect.inspect(error));
                    // TODO: replace the constant with specific error
                    content = {
                        code: 40000,
                        message: 'Incoming request can not be parsed ' +
                                 'successfully. Error: ' + error.toString()
                    };
                    body = JSON.stringify(content);
                    
                    response.writeHead(400, {
                        'Content-Type': 'application/json',
                        'Content-Length': body.length
                    });
                    
                    response.end(body);
                    return;
                }
                
                logger.debug(message + ' succeed. Fields: ' +
                             C.lang.reflect.inspect(fields) + ', files: ' +
                             C.lang.reflect.inspect(files));
                             
                request.data = fields;
                request.files = files;
                next();
            });
        };
    };
    
    C.namespace('caligula.middleware.connect').multipart = multipart;
    
}, '0.0.1', { requires: ['caligula.logging'] });