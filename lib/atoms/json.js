/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var tools = require('../tools.js');

/** Process job asynchronously. */
exports.execute = function(job, $) {
    var json = JSON.stringify(tools.object(this.field('using', job, {})), null, 4);
    var encoding = this.field('encoding', job, 'utf-8');
    job.response.writeHead(200, {
        'content-type': 'application/json; charset=' + encoding,
        'content-length': Buffer.byteLength(json),
    });
    job.response.end(json);
    $(false);
};
