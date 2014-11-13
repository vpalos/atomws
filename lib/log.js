/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Log a regular message. */
exports.say = function() {
    arguments[0] = '#' + process.pid + ': ' + arguments[0];
    console.log.apply(null, arguments);
};

/** Log a warning message. */
exports.cry = function() {
    arguments[0] = '#' + process.pid + ': WARNING: ' + arguments[0];
    console.warn.apply(null, arguments);
};

/** Log a fatal message and abort execution. */
exports.die = function() {
    arguments[0] = '#' + process.pid + ': ERROR: ' + arguments[0] + ' Aborting...';
    console.error.apply(null, arguments);
    process.kill(process.pid, 'SIGKILL');
};
