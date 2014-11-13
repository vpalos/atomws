/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var fs = require('fs');
var events = require('events');
var path = require('path');
var util = require('util');
var cli = require('../cli.js');
var log = require('../log.js');
var tools = require('../tools.js');
var Job = require('./Job.js');

/** Harvest atom types. */
var __atom_types = {};
var where = path.resolve(__dirname + '/../atoms');
var files = fs.readdirSync(where);
for (var i = files.length; i--;) {
    __atom_types[path.basename(files[i], '.js')] = require(where + '/' + files[i]);
}

/** Basic atom class. */
var Atom = function(service, schema, ancestor) {

    // equip object
    var parts = Atom.identify(schema.atom);
    Object.defineProperties(this, {
        schema:    { value: schema, configurable: false, writable: false },
        type:      { value: parts[0], configurable: false, writable: false },
        id:        { value: parts[1], configurable: false, writable: false },
        service:   { value: service, configurable: false, writable: false },
        ancestor:  { value: ancestor, configurable: false, writable: false },
        successor: { value: null, configurable: false, writable: true }
    });

    // equip atom
    var mixin = __atom_types[this.type];
    if (!mixin) {
        throw new Error(util.format("Unknown atom type: '%s'!", this.type));
    }
    tools.collapse(this, mixin);

    // initialize
    this.service.save(this);
    this._prepare();
};
util.inherits(Atom, events.EventEmitter);

/** Instantiate an atom as an offspring of this one. */
Atom.prototype.atomize = function(schema) {
    return Atom.atomize(this.service, schema, this);
};

/** Instantiate a sequence of atoms as offsprings of this one. */
Atom.prototype.sequence = function(schema) {
    return Atom.sequence(this.service, schema, this);
};

/** Preparation wrapper. */
Atom.prototype._prepare = function(job, $) {
    if (!this.prepare) {
        return;
    }
    this.on('prepared', function() {
        this.removeAllListeners('prepared');
        this.prepare = null;
    });
    var self = this;
    process.nextTick(function() {
        self.prepare(function(state) {
            if (!state) {
                throw new Error(util.format("Atom '%s%s' failed to initialise!", self.type, self.id));
            }
            self.emit('prepared');
        });
    });
};

/** Execution wrapper. */
Atom.prototype._execute = function(job, $) {
    try {
        this.execute(job, $);
    } catch(e) {
        job.trail = this;
        Job.recycler.release(job, e);
        if (cli.options.debug) {
            throw e;
        }
    }
};

/** Route a job through. */
Atom.prototype.route = function(job) {

    // execution callback
    var self = this;
    var $ = function(act, trail) {

        // interpret action
        var next = null;
        if (act) {
            next = self.atomize(act);
            if (next) {
                job.trail = self;
            } else {
                var level = self;
                while (level && !(next = level.successor)) {
                    level = level.ancestor;
                }
            }
        } else {
            job.trail = self;
        }
        
        // extra tail detail
        if (trail) {
            job.trail = trail;
        }

        // proceed
        if (act) {
            process.nextTick(function() {
                (next || self.service.failure).route(job);
            });
        } else {
            Job.recycler.release(job);
        }
    };

    // check job
    if (job.timeout === -1 || !job.request.connection.__job) {
        return;
    }

    // invoke execution
    if (this.execute) {
        if (this.prepare) {
            this.on('prepared', function() {
                self._execute(job, $);
            });
        } else {
            this._execute(job, $);
        }
    } else {
        $(true);
    }
};

/** Return a potentially dynamically generated atom field. */
Atom.prototype.field = function(field, job, fallback) {
    var value = this.schema[field];
    var type = tools.typeof(value);
    if (type === 'function') {
        value = value.call(this, job);
        type = tools.typeof(value);
    }
    if (type === 'null' || type === 'undefined') {
        value = fallback;
    }
    return value;
};

/** Extract a valid atom ID from the given string. */
Atom.identify = function(string) {
    var parts = string.toLowerCase().match(/^\s*([\w.-]*)\s*(:\s*([\w.-]*)\s*)?$/);
    if (!parts) {
        throw new Error(util.format("Invalid atom declaration: '%s'!", string));
    }
    return [ parts[1] || '', ':' + (parts[3] || '') ];
};

/** Instantiate an atom. */
Atom.atomize = function(service, schema, ancestor) {
    if (tools.typeof(schema) === 'object') {
        if (schema instanceof Atom) {
            return schema;
        } else {
            return new Atom(service, schema, ancestor);
        }
    }
};

/** Instantiate a sequence of atoms. */
Atom.sequence = function(service, schemas, ancestor) {
    var chain = [];
    var schemas = tools.array(schemas);
    var count = schemas.length;
    for (var i = 0; i < count; i++) {
        var atom = Atom.atomize(service, schemas[i], ancestor);
        if (i > 0) {
            chain[i - 1].successor = atom;
        }
        chain.push(atom);
    }
    return chain;
};

/** Produce a string representation of this atom. */
Atom.prototype.toString = function() {
    return util.inspect(this.schema, false, 0).replace(/\n/g, '');
};

/** Exports. */
module.exports = Atom;
