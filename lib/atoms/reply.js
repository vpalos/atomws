/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var tools = require('../tools.js');

/** Process job asynchronously. */
exports.execute = function(job, $) {

    // assemble
    var content = this.field('content', job, '');
    var mime = this.field('mime', job, 'text/html');
    var encoding = this.field('encoding', job, 'utf-8');
    var headers = tools.collapse(this.field('headers', job, {}),
                                 { 'content-type': mime + '; charset=' + encoding, 
                                   'content-length': Buffer.byteLength(content) },
                                 true);
    
    // reply
    job.response.writeHead(200, headers);
    job.response.end(content);

    // stop routing
    $(false);
};
