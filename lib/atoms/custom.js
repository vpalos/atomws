/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var tools = require('../tools.js');

/** Initialize atom. */
exports.prepare = function($) {
    if (this.schema.prepare) {
        this.schema.prepare.call(this, $);
    } else {
        $(true);
    }
};

/** Process job asynchronously. */
exports.execute = function(job, $) {
    if (this.schema.execute) {
        this.schema.execute.call(this, job, $);
    } else {
        $(true);
    }
};
