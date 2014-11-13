/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var http = require('http');
var util = require('util');
var tools = require('../tools.js');

/** Process job asynchronously. */
exports.execute = function(job, $) {

    // assemble
    var title = this.service.hide ? '' : util.format('%s (%s), ', this.service.title, this.service.powered);
    var code = this.field('code', job, 404);
    var reason = this.field('reason', job, http.STATUS_CODES[code] || '(UNKNOWN)');
    var content = tools.template(code + ': ' + reason, title + Date());
    var encoding = this.field('encoding', job, 'utf-8');

    // reply
    job.response.writeHead(code, reason, {
        'content-type': 'text/html; charset=' + encoding,
        'content-length': Buffer.byteLength(content),
    });
    job.response.end(content);

    // stop routing
    $(false);
};
