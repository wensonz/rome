/**
 * This module parse multipart request bodies and files,
 * providing the parsed object as `req.body` and `req.files`.
 *
 * @module caligula.middlewares.http
 */
Condotti.add('caligula.middlewares.http', function (C) {
    
    var Multipart = C.require('rome-multipart');

    C.namespace('caligula.middleware.connect').multipart = Multipart;
    
}, '0.0.1', { requires: [] });
