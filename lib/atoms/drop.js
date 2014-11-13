/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Process job asynchronously. */
exports.execute = function(job, $) {
    job.request.connection.destroy();
    $(false, '--connection dropped forcefully--');
};
