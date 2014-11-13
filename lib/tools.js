/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var util = require('util');

/** Generate a lambda function. */
exports.lambda = function(value) {
    if (!arguments.length) {
        return function(value) {
            return value;
        }
    } else {
        return function() {
            return value;
        }
    }
};

/** An empty function. */
exports.noop = function() {}

/** Determine accurate type of a variable. */
exports.typeof = function(data) {
    var type = typeof(data);
    if (type === 'object') {
        if (data === null) { // null
            return 'null';
        }
        if (util.isArray(data)) { // Array
            return 'array';
        }
        if (util.isDate(data)) { // Date
            return 'date';
        }
        if (util.isRegExp(data)) { // RegExp
            return 'regexp';
        }
        return 'object'; // object
    }
    return type; // undefined, boolean, number, string, function
};

/** Ensure that given value is a string. */
exports.string = function(value) {
    var type = exports.typeof(value);
    return type !== 'string' ? String((type === 'null' || type === 'undefined') ? '' : value) : value;
};

/** Ensure that given value is an array. */
exports.array = function(value) {
    return exports.typeof(value) === 'array' ? value : value ? [ value ] : [];
};

/** Ensure that given value is an object. */
exports.object = function(value) {
    return exports.typeof(value) === 'object' ? value : {};
};

/** Round a number to a specific decimal precision.  */
exports.round = function(number, precision) {
	var span = Math.pow(10, (precision * 1) || 0);
	return Math.round(number * span) / span;
};

/** Generate human-readable representation of a time interval. */
exports.humanInterval = function(s) {
    var w = Math.floor(s / 604800);
    s %= 604800;
    var d = Math.floor(s / 86400);
    s %= 86400;
    var h = Math.floor(s / 3600);
    s %= 3600;
    var m = Math.floor(s / 60);
    var t = [];
    if (w) t.push(util.format('%dw', w));
    if (d) t.push(util.format('%dd', d));
    if (h) t.push(util.format('%dh', h));
    if (m) t.push(util.format('%dm', m));
    t.push(util.format('%ds', Math.floor(s % 60)));
    return t.join(':');
};

/** Generate human-readable representation of a byte/bit size (default is byte). */
exports.humanSize = function(value, bit, suffix) {
    var sizes = [ 'T', 'G', 'M', 'K' ];
    var cutoff = bit ? 1000 : 1024;
    var unit = bit ? 'b' : 'B';
    var size = '';
    while (value >= cutoff && sizes.length) {
        size = sizes.pop();
        value /= cutoff;
    }
    return util.format('%d%s%s%s', exports.round(value, 1), size, unit, suffix || '');
};

/** Collapse given objects from right to left into one big object.
    If the last parameter is boolean, it specifies wether keys are converted to lowercase. */
exports.collapse = function(target) {

    // prepare
    target = exports.typeof(target) === 'object' ? target : {};
    var lower = arguments[arguments.length - 1];
    lower = typeof(lower) === 'boolean' ? lower : null;

    // walk inputs
    var count = arguments.length - (lower * 1);
    for (var i = 1; i < count; i++) {
        var data = arguments[i];
        if (exports.typeof(data) === 'object') {
            var keys = Object.keys(data);
            for (var j = keys.length; j--;) {
                var field = keys[j];
                target[field] = exports.typeof(data[field]) === 'object' ?
                                arguments.callee(target[field], data[field]) :
                                data[field];
            }
        }
    }

    // lowercase
    if (lower) {
        var keys = Object.keys(target);
        for (var i = keys.length; i--;) {
            var key = keys[i];
            if (typeof(key) === 'string') {
                var lckey = key.toLowerCase();
                if (key !== lckey) {
                    if (!target[lckey]) {
                        target[lckey] = target[key];
                    }
                    delete target[key];
                }
            }
        }
    }

    // ready
    return target;
};

/** Cumulate given objects from right to left into one big object, by adding all their members. */
exports.cumulate = function(target) {

    // prepare
    target = exports.typeof(target) === 'object' ? target : {};

    // walk inputs
    var count = arguments.length;
    for (var i = 1; i < count; i++) {
        var data = arguments[i];
        if (exports.typeof(data) === 'object') {
            var keys = Object.keys(data);
            for (var j = keys.length; j--;) {
                var field = keys[j];
                switch (exports.typeof(data[field])) {
                case 'object':
                    target[field] = arguments.callee(target[field], data[field]);
                    break;
                case 'number':
                    target[field] = exports.round((target[field] * 1 || 0) + (data[field] * 1 || 0), 3);
                    break;
                default:
                    target[field] = data[field];
                    break;
                }
            }
        }
    }

    // ready
    return target;
};

/** Translate an IP into a numeric figure. */
var IPvX = {
    0: exports.lambda(0),
    4: function(ip) {
        ip = ip.split('.');
        return (Number(ip[0]) << 24) + (Number(ip[1]) << 16) + (Number(ip[2]) << 8) + Number(ip[3]);
    },
    6: function(ip) {
        log.cry("IPv6 is not yet supported: '%s'!", ip);
        return 0;
    },
};

/** IP parsing wrapper. */
exports.ip2num = function(ip) {
    return IPvX[net.isIP(ip)](ip);
};

/** Very basic informational HTML template. */
var __template_line = new Array(80).join('-') + '\n';
exports.template = function() {
    var title = arguments[0] || '-';
    var template = '<html><head><title>' + title + '</title></head><body><pre>' + title + '\n';
    var count = arguments.length;
    for (var i = 1; i < count; i++) {
        var line = arguments[i];
        if (line) {
            template += __template_line;
            template += line;
        }
    }
    template += '</re></body></html>';
    return template;
};

/** Metrics counter. */
exports.increment = function(object, field, value) {
    object[field] = (object[field] || 0) + (value || 1);
};
