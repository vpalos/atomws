/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var util = require('util');
var cli = require('../cli.js');
var tools = require('../tools.js');

/** Initialize atom. */
exports.prepare = function($) {

    // prepare matching rules
    this.__using = tools.array(this.schema['using']).reverse();
    for (var i = this.__using.length; i--;) {
        var rule = this.__using[i];
        switch (tools.typeof(rule)) {
            case 'function':
                break;
            case 'object':
                var keys = Object.keys(rule);
                for (var j = keys.length; j--;) {
                    var key = keys[j];
                    if (tools.typeof(rule[key]) === 'array') {
                        if (tools.typeof(rule[key][0]) !== 'regexp') {
                            rule[key][0] = new RegExp(tools.string(rule[key][0]), 'i');
                        }
                        rule[key][1] = tools.string(rule[key][1]);
                    } else {
                        rule[key] = [ /^.*$/, tools.string(rule[key]) ];
                    }
                }
                break;
            default:
                log.die('Invalid alter rule (must be function or object): %s.', util.inspect(rule));
        }
    }

    // ready
    $(true);
};

/** Process job asynchronously. */
exports.execute = function(job, $) {

    // prepare
    var affected = false;
    
    // apply rules
    var count = this.__using.length;
    for (var i = count; i--;) {
        var rule = this.__using[i];
        
        // custom function altering rule
        if (typeof(rule) === 'function') {
            rule(job);
            affected = true;
            continue;
        }

        // classic walk alter fields
        var keys = Object.keys(rule);
        for (var j = keys.length; j--;) {
            var key = keys[j];
            var source = job.field(key);
            if (rule[key][0].test(source)) {
                var value = source.replace(rule[key][0], rule[key][1]);
                job.field(key, value);
                if (cli.options.debug) {
                    affected = true;
                }
            }
        }
    }

    // proceed
    if (affected) {
        job.trail = this;
    }
    $(true);
};
