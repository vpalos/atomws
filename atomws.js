#!/usr/bin/env node

/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var cluster = require('cluster');
var os = require('os');
var path = require('path');
var util = require('util');
var Service = require('./lib/core/Service.js');
var cli = require('./lib/cli.js');
var log = require('./lib/log.js');
var tools = require('./lib/tools.js');

/** Constants. */
global['ATOMWS_CAPTION'] = 'AtomWS';
global['ATOMWS_VERSION'] = 'v2.0-beta';
global['ATOMWS_ROOT'] = path.dirname(process.argv[1]);

/** Initialise. */
var path = require('path');
var schema = require(path.resolve(cli.options.schema));
var workers = {};
var deaths = 0;
var backend = null;

/** Worker message handlers. */
var handlers = {

    /** Start-up handler. */
    up: function() {
        workers[this.pid] = this;
        this.removeAllListeners('exit');
        this.on('exit', function() {
            (handlers.down || handlers.exit).call(this);
        });
        spawn();
    },

    /** Respawning handler. */
    down: function() {
        log.cry('Worker #%d died! Respawning...', this.pid);
        delete workers[this.pid];
        deaths++;
        spawn();
    },

    /** Fatal exit handler. */
    fatal: function() {
        log.cry('Execution failure in worker #%d!', this.pid);
        master_exit();
    },

    /** Shutdown handler. */
    exit: function() {
        log.cry('Worker #%d down!', this.pid);
        delete workers[this.pid];
    },

    /** Assimilate worker metrics. */
    metrics: function(metrics) {
        this.metrics = metrics;
    }
};

/** Lock-down security level. */
var complete = function(owner, group) {
    owner = (typeof(owner) === 'undefined') ? schema.owner : owner;
    group = (typeof(group) === 'undefined') ? schema.group : group;
    if (group) {
        process.setgid(group);
    }
    if (owner) {
        process.setuid(owner);
    }
    log.say("%s is up (uid:%s, gid:%s).", 
            cluster.isMaster ? 'Master' : 'Worker #' + process.pid,
            owner || process.getuid(), 
            group || process.getgid());
};

/** Initialize backend listener. */
var backend_up = function() {
    var _cb = function() {
        complete(null, null);
        backend_up = tools.noop;
    };
    if (backend) {
        backend.up(function() {
            try {
                _cb();
            } catch(e) {
                backend.down(function() {
                    log.die("Unable to launch backend service: %s!", e.message || e);
                });
            }
        });
    } else {
        _cb();
    }
};

/** Spawn a new worker process. */
var spawn = function() {
    if (schema.workers > Object.keys(workers).length) {
        var worker = cluster.fork();
        worker.on('message', function(message) {
            if (message && message.event in handlers) {
                handlers[message.event].call(worker, message);
            }
        });
        worker.on('exit', handlers.fatal);
    } else {
        backend_up();
    }
};

/** Send a kill signal to the running process. */
var process_kill = function(title) {
    log.cry("Issuing kill for non-responsive %s!", title);
    process.kill(process.pid, 'SIGKILL');
};

/** Stop all workers. */
var master_exit = function() {

    // prepare
    master_exit = tools.noop;
    spawn = tools.noop;
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGHUP');
    process.removeListener('exit', arguments.callee);
    delete handlers.down;

    // master killer
    var mk_timer = setTimeout(function() { 
        process_kill('master #' + process.pid); 
    }, 5000);
    var _exit = function() {
        var __exit = function() {
            log.say("Master is down.");
            clearTimeout(mk_timer);
            process.exit(0);
        };
        if (backend) {
            backend.down(__exit);
            backend = null;
        } else {
            __exit();
        }
    };

    // end workers gracefully /w fallback
    var keys = Object.keys(workers);
    var left = keys.length;
    if (left) {
        log.say('Stopping workers...');
        for (var i = keys.length; i--;) {
            var worker = workers[keys[i]];
            worker.on('exit', function() {
                if (--left === 0) {
                    _exit();
                }
            });
            worker.send({ event: 'exit' });
        }
    } else {
        _exit();
    }
};

/** Stop running worker. */
var worker_exit = function() {
    var wk_timer = setTimeout(function() { process_kill('worker #' + process.pid); }, 2500);
    worker.down(function() {
        clearTimeout(wk_timer);
        process.exit(0);
    });
};

/** Unhandled exceptions. */
process.on('uncaughtException', function(e) {
    log.cry('UncaughtException:', (cli.options.debug && e.stack) || e.message || e || 'Unknown exception!');
});

/** Start master/worker. */
if (cluster.isMaster) {

    // log
    log.say('%s %s master process.', global['ATOMWS_CAPTION'], global['ATOMWS_VERSION']);

    // handle events
    process.on('SIGINT',  function() { log.cry('Caught SIGINT.');  master_exit(); });
    process.on('SIGTERM', function() { log.cry('Caught SIGTERM.'); master_exit(); });
    process.on('SIGHUP',  function() { log.cry('Caught SIGHUP.');  master_exit(); });
    process.on('exit',    master_exit);

    // metrics aggregator
    Object.defineProperty(process, 'metrics', {
        get: function() {
            var keys = Object.keys(workers);
            var loads = os.loadavg();
            var memory = os.totalmem();
            var metrics = {
                'service': schema.title,
                'server': 'AtomWS/' + global['ATOMWS_VERSION'],
                'platform': 'NodeJS/' + process.version,
                'date': Math.floor(Date.now()),
                'uptime': {
                    'system': tools.round(os.uptime(), 3),
                    'server': tools.round(process.uptime(), 3),
                },
                'load': {
                    '1m': tools.round(loads[0], 3),
                    '5m': tools.round(loads[1], 3),
                    '15m': tools.round(loads[2], 3),
                },
                'memory': {
                    'system-total': memory,
                    'system-used': memory - os.freemem()
                },
                'workers': {
                    'up': keys.length,
                    'deaths': deaths
                }
            };
            for (var i = keys.length; i--;) {
                tools.cumulate(metrics, workers[keys[i]].metrics);
            }
            if (backend) {
                tools.cumulate(metrics, backend.metrics);
            }
            delete metrics.event;
            return metrics;
        }
    });

    // spawn backend
    if (tools.typeof(schema.back) !== 'null') {
        backend = new Service({
            title: schema.title,
            favicon: schema.favicon,
            bind: schema.back || '127.0.0.1:81',
            hide: schema.hide,
            route: [ 
                {
                    atom: 'match',
                    using: {
                        'path': '^/metrics$'
                    },
                    route: {
                        atom: 'json',
                        using: function(job) {
                            var metrics = process.metrics;
                            with (metrics) {
                                var bits = job.parameters.bits;
                                if (bits) {
                                    data['current-rate'] *= 8;
                                    data['maximum-rate'] *= 8;
                                }
                                if (job.parameters.human === 'true') {
                                    date = new Date(date).toLocaleString();
                                    for (var key in uptime) {
                                        uptime[key] = tools.humanInterval(uptime[key]);
                                    }
                                    for (var key in memory) {
                                        memory[key] = tools.humanSize(memory[key]);
                                    }
                                    data['total'] = tools.humanSize(data['total']);
                                    data['input'] = tools.humanSize(data['input']);
                                    data['output'] = tools.humanSize(data['output']);
                                    data['current-rate'] = tools.humanSize(data['current-rate'], bits, '/s');
                                    data['maximum-rate'] = tools.humanSize(data['maximum-rate'], bits, '/s');
                                    connections['current-rate'] += '/s';
                                    connections['maximum-rate'] += '/s';
                                    requests['current-rate'] += '/s';
                                    requests['maximum-rate'] += '/s';
                                }
                            }
                            return metrics;
                        }
                    }
                } 
            ]
        });
    }

    // spawn workers
    schema.workers = schema.workers || require('os').cpus().length;
    if (schema.workers < 1) {
        schema.workers = 1;
    }
    if (schema.workers > 1000) {
        schema.workers = 1000;
    }
    spawn();    

} else {

    // create worker
    var worker = new Service(schema);

    // controlled exit
    process.on('SIGINT', tools.noop);
    //process.on('SIGTERM', tools.noop);
    //process.on('SIGHUP', tools.noop);
    process.on('exit', tools.noop);

    // communication
    process.on('message', function(message) {
        if (message) {
            switch (message.event) {

            // worker termination
            case 'exit':
                worker_exit();
                break;

            // unknown
            default:
                break;
            }
        }
    });

    // start worker
    worker.up(function() {
        try {
            complete();
            process.send({ event: 'up' });
        } catch(e) {
            worker.down(function() {
                log.die("Failed to switch ownership: %s!", e.message || e);
            });
        }
    });
}
