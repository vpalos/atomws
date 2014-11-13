/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var tools = require('../tools.js');

/** Initialize atom. */
exports.prepare = function($) {
    this.__place_child = this.sequence(this.schema.route)[0];
    $(true);
};

/** Process job asynchronously. */
exports.execute = function(job, $) {
    $(this.__place_child || true);
};
