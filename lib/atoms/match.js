/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var util = require('util');
var cli = require('../cli.js');
var log = require('../log.js');
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
                    rule[key] = tools.array(rule[key]).reverse();
                    for (var k = rule[key].length; k--;) {
                        if (tools.typeof(rule[key][k]) !== 'regexp') {
                            rule[key][k] = new RegExp(tools.string(rule[key][k]), 'i');
                        }
                    }
                }
                break;
            default:
                log.die('Invalid match rule (must be function or object): %s.', util.inspect(rule));
        }
    }

    // prepare offsprings
    this.__match_child = this.sequence(this.schema.route)[0];

    // ready
    $(true);
};

/** Process job asynchronously. */
exports.execute = function(job, $) {

    // walk rules
    var next = true;
    var count = this.__using.length;
    for (var i = count; i--;) {
        var rule = this.__using[i];
        
        // custom function matching rule
        if (typeof(rule) === 'function') {
            if (rule.call(this, job)) {
                next = this.__match_child;
                break;
            }
            continue;
        }
        
        // classic walk rule fields
        var match_rule = true;
        var keys = Object.keys(rule);
        for (var j = keys.length; j--;) {
            var key = keys[j];

            // extract source
            var match_value = false;
            var source = tools.string(key);
            var expect = true;
            if (source.charAt(source.length - 1) === '!') {
                source = source.slice(0, -1);
                expect = false;
            }
            source = job.field(source);

            // walk/test field values
            for (var k = rule[key].length; k--;) {
                if (rule[key][k].test(source)) {
                    match_value = true;
                    break;
                }
            }
            
            // check result
            if (match_value !== expect) {
                match_rule = false;
                break;
            }
        }
        
        // test rule result
        if (match_rule) {
            next = this.__match_child;
            break;
        }
    }

    // proceed
    $(next);
};
