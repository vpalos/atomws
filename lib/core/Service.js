/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var cluster = require('cluster');
var http = require('http');
var path = require('path');
var util = require('util');
var cli = require('../cli.js');
var log = require('../log.js');
var tools = require('../tools.js');
var Atom = require('./Atom.js');
var Job = require('./Job.js');
var Measure = require('./Measure.js');
var Recycler = require('./Recycler.js');

/** Service manager class. */
var Service = function(schema) {

    // prepare schema
    var self = this;
    this.__up = false;
    var schema = tools.collapse({ title: global['ATOMWS_CAPTION'],
                                  bind: '*:80',
                                  hide: false,
                                  route: [] }, schema);

    // prepare endpoints
    var _binds = [];
    var items = tools.array(schema.bind);
    for (var i = items.length; i--;) {
        var item = items[i];
        var parts = item.match(/^(\*|[a-z0-9.-]*):(\d*)$/i);
        if (parts) {
            _binds.push({ ip: parts[1] !== '*' ? parts[1] || null : null,
                          port: parts[2] || 80 });
        } else {
            _binds.push(path.resolve('/tmp', item));
        }
    }

    // prepare metrics
    this.metrics = {
        'data': {
            'total': 0,
            'input': 0,
            'output': 0,
        },
        'connections': {
            'total': 0,
            'failed': 0,
            'current-open': 0,
            'maximum-open': 0,
        },
        'requests': {
            'total': 0,
            'timed-out': 0,
            'by-status': {},
            'by-host': {},
        }
    };

    // dynamic metrics
    Object.defineProperties(this.metrics, {
        'memory': {
            get: function() {
                var usage = process.memoryUsage();
                return {
                    'heap-total': usage.heapTotal,
                    'heap-used': usage.heapUsed,
                    'server': usage.rss
                };
            },
            set: tools.noop,
            enumerable: true
        },
        'objects': {
            get: function() {
                return Recycler.metrics();
            },
            set: tools.noop,
            enumerable: true
        }
    });
    var __data_rate = Measure.recycler.allocate();
    Object.defineProperties(this.metrics.data, {
        'current-rate': {
            get: function() { return __data_rate.value() },
            set: function(value) { __data_rate.add(value) },
            enumerable: true
        },
        'maximum-rate': {
            get: function() { return __data_rate.maximum() },
            set: tools.noop,
            enumerable: true
        }
    });
    var __connections_rate = Measure.recycler.allocate();
    Object.defineProperties(this.metrics.connections, {
        'current-rate': {
            get: function() { return __connections_rate.value() },
            set: function(value) { __connections_rate.add(value) },
            enumerable: true
        },
        'maximum-rate': {
            get: function() { return __connections_rate.maximum() },
            set: tools.noop,
            enumerable: true
        }
    });
    var __requests_rate = Measure.recycler.allocate();
    Object.defineProperties(this.metrics.requests, {
        'current-rate': {
            get: function() { return __requests_rate.value() },
            set: function(value) { __requests_rate.add(value) },
            enumerable: true
        },
        'maximum-rate': {
            get: function() { return __requests_rate.maximum() },
            set: tools.noop,
            enumerable: true
        }
    });

    // create event loop
    var _loop = http.createServer();

    // socket counter function
    var measure = function(socket) {
        var _in = socket.bytesRead - socket.__oldBytesRead;
        var _out = socket.bytesWritten - socket.__oldBytesWritten;
        socket.__oldBytesRead = socket.bytesRead;
        socket.__oldBytesWritten = socket.bytesWritten;
        self.metrics.data['total'] += _in + _out;
        self.metrics.data['current-rate'] = _in + _out;
        self.metrics.data['input'] += _in;
        self.metrics.data['output'] += _out;
    };

    // prepare new connection
    _loop.on('connection', function(socket) {

        // push metrics
        self.metrics.connections['total']++;
        self.metrics.connections['current-rate'] = 1;
        self.metrics.connections['current-open']++;
        if (self.metrics.connections['current-open'] > self.metrics.connections['maximum-open']) {
            self.metrics.connections['maximum-open'] = self.metrics.connections['current-open'];
        }

        // cleanup connection
        socket.on('close', function(error) {
            this.removeListener('close', arguments.callee);
            clearInterval(this.__metrics_timer);
            self.metrics.connections['failed'] += error ? 1 : 0;
            self.metrics.connections['current-open']--;
            measure(this);
            if (this.__job) {
                this.__job.trail = '--connection failed unexpectedly--';
                Job.recycler.release(this.__job);
            }
        });

        // initiate
        socket.__job = null;
        socket.__oldBytesRead = 0;
        socket.__oldBytesWritten = 0;
        socket.__metrics_timer = setInterval(measure, 1000, socket);
    });

    // prepare new request (job)
    _loop.on('request', function(request, response) {
        process.nextTick(function() {
            self.metrics.requests['total']++;
            self.metrics.requests['current-rate'] = 1;
            self.entrance.route(Job.recycler.allocate(self, request, response));
        });
    });

    // properties
    Object.defineProperties(this, {
        schema:   { value: schema,                      configurable: false, writable: false },
        title:    { value: schema.title,                configurable: false, writable: false },
        bind:     { value: _binds,                      configurable: false, writable: false },
        powered:  { value: 'NodeJS/' + process.version, configurable: false, writable: false },
        hide:     { value: schema.hide,                 configurable: false, writable: false },
        secure:   { value: false,                       configurable: false, writable: false },
        loop:     { value: _loop,                       configurable: false, writable: true  },
        lookup:   { value: {},                          configurable: false, writable: false },
    });

    // prepare favicon
    if (tools.typeof(this.schema.favicon) === 'undefined') {
        this.schema.favicon = global['ATOMWS_ROOT'] + '/lib/files/favicon.ico';
    }
    var favicon = this.schema.favicon ? path.resolve(this.schema.favicon) : null;

    // prepare forefront end-point atom
    schema.route = tools.array(schema.route);
    schema.route.unshift({
        atom: 'match',
        using: function(job) {
            return favicon && !this.service.hide && job.path == '/favicon.ico';
        },
        route: [
            {
                atom: 'alter',
                using: { 'path': path.basename(favicon) }
            },
            {
                atom: 'file',
                mimes: { 'ico': 'image/x-icon' },
                root: path.dirname(favicon)
            }
        ]
    });
    
    // end-point atoms
    var _atom_top = new Atom(this, { atom: 'place:top', route: schema.route });
    var _atom_fail = new Atom(this, { atom: 'error:fallback', code: 404 }, _atom_top);
    
    // store end-point atoms
    Object.defineProperties(this, {
        entrance: { value: _atom_top,  configurable: false, writable: false },
        failure:  { value: _atom_fail, configurable: false, writable: false },
    });
};

/** Start listening on all designated endpoints. */
Service.prototype.up = function(cb) {
    var self = this;
    var left = this.bind.length;
    var _cb = function() {
        if (--left <= 0) {
            if (cluster.isWorker) {
                var _send_metrics = function() {
                    process.send(tools.collapse({ event: 'metrics' }, self.metrics));
                };
                self.__metrics_timer = setInterval(_send_metrics, 5000);
                _send_metrics();
            }
            (cb || tools.noop)();
        }
    };
    try {
        for (var i = this.bind.length; i--;) {
            var bind = this.bind[i];
            if (typeof(bind) === 'string') {
                this.loop.listen(bind, _cb);
            } else {
                if (bind.port < 1024 && process.getuid() != 0) {
                    log.die("Only 'root' may bind to port %d!", bind.port);
                }
                if (bind.ip) {
                    this.loop.listen(bind.port, bind.ip, _cb);
                } else {
                    this.loop.listen(bind.port, _cb);
                }
            }
        }
    } catch(e) {
        log.die('Failed to bind service: ' + (cli.options.debug ? e.stack : e.message));
    }
};

/** Stop the running service. */
Service.prototype.down = function(cb) {
    var _cb = cb || tools.noop;
    try {
        if (cluster.isWorker) {
            clearInterval(this.__metrics_timer);
        }
        if (this.loop !== null) {
            this.loop.removeAllListeners();
            this.loop.close();
            this.loop = null;
        }
        _cb();
    } catch(e) {
        _cb();
    }
};

/** Store a newly created atom in the registry. */
Service.prototype.save = function(atom) {
    if (atom.id) {
        if (atom.id !== ':' &&
            this.lookup[atom.id] &&
            this.lookup[atom.id] !== atom) {
            log.die(util.format("Duplicate atom ID '%s'!", atom.id));
        }
        this.lookup[atom.id] = atom;
    }
};

/** Retrieve a registered atom using the given ID. */
Service.prototype.load = function(name) {
    var id = Atom.identify(name);
    return this.lookup[tools.string(id[1])] || null;
};

/** Exports. */
module.exports = Service;
