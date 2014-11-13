/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var util = require('util');
var tools = require('../tools.js');

/** Initialize atom. */
exports.prepare = function($) {
    this.__jump_fallback = this.atomize({ atom: 'error', 
                                     code: 500, 
                                     reason: util.format("Invalid jump id '%s'!", this.field('to')) });
    $(true);
};

/** Process job asynchronously. */
exports.execute = function(job, $) {
    var target = this.service.load(this.field('to', job, ''));
    $(target || this.__jump_fallback);
};
