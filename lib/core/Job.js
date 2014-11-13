/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var path = require('path');
var util = require('util');
var cli = require('../cli.js');
var log = require('../log.js');
var tools = require('../tools.js');
var Atom = require('./Atom.js');
var Recycler = require('./Recycler.js');

/** RegExp parsers. */
var __re_uri = /^(([^:]*):\/\/)?(.*@)?([^@:/?]*):?(\d*)(.*)$/;
var __re_url = /^([^?#]*)(\?[^#]*)?/;

/** Match a URI parsing regexp and return captures. */
var __parse = function(value, re, title) {
    var value = tools.string(value);
    var parts = value.match(re);
    if (!parts) {
        throw new Error(util.format("Invalid %s given: '%s'!", title, value));
    }
    return parts;
};

/** A request/response pair possibly with additional data. */
var Job = function() {

    // carrier
    var self = this;

    // internals
    Object.defineProperties(this, {
        service:  { value: null, configurable: false, enumerable: false, writable: true },
        request:  { value: null, configurable: false, enumerable: false, writable: true },
        response: { value: null, configurable: false, enumerable: false, writable: true }
    });

    // non-URI properties
    var _method = '';
    var _headers = {};
    Object.defineProperties(this, {
        method: {
            get: function() { return _method; },
            set: function(value) { _method = tools.string(value).toUpperCase(); },
            enumerable: true
        },
        headers: {
            get: function() { return _headers; },
            set: function(value) { _headers = tools.collapse({}, tools.object(value)); },
            enumerable: true
        },
        client: { value: { ip: '', port: '' }, configurable: false, enumerable: true, writable: false }
    });

    // URI properties
    var _uri = null;
    var _protocol = '';
    var _host = '';
    var _port = '';
    var _url = null;
    var _path = '';
    var _query = null;
    var _parameters = {};
    Object.defineProperties(this, {
        uri: {
            get: function() {
                if (_uri === null) {
                    _uri = util.format('%s://%s%s%s',
                                       this.protocol, this.host,
                                       this.port ? ':' + this.port : '', this.url);
                }
                return _uri;
            },
            set: function(value) {
                _uri = null;
                var parts = __parse(value, __re_uri, 'URI');
                this.protocol = parts[2] || '';
                this.host = parts[4] || '';
                this.port = parts[5] || '';
                this.url = parts[6] || '';
            },
            enumerable: true
        },
        protocol: {
            get: function() { return _protocol; },
            set: function(value) { _protocol = tools.string(value).toLowerCase(); _uri = null; },
            enumerable: true
        },
        host: {
            get: function() { return _host; },
            set: function(value) { _host = tools.string(value).toLowerCase(); _uri = null; },
            enumerable: true
        },
        port: {
            get: function() { return _port; },
            set: function(value) { _port = parseInt(value) || ''; _uri = null; },
            enumerable: true
        },
        url: {
            get: function() {
                if (_url === null) {
                    _url = this.path + this.query;
                }
                return _url;
            },
            set: function(value) {
                _uri = _url = null;
                var parts = __parse(value, __re_url, 'URL');
                this.path = parts[1] || '';
                this.query = parts[2] || '';
            },
            enumerable: true
        },
        path: {
            get: function() { return _path; },
            set: function(value) { _path = path.normalize('/' + tools.string(value) + '/.'); _url = null; },
            enumerable: true
        },
        query: {
            get: function() {
                if (_query === null) {
                    var keys = Object.keys(_parameters);
                    var parts = [];
                    for (var i = keys.length; i--;) {
                        var value = _parameters[keys[i]];
                        var type = tools.typeof(value);
                        if (type === 'null' || type === 'undefined') {
                            value = '';
                        }
                        parts.push(keys[i] + '=' + value);
                    }
                    _query = parts.length ? '?' + parts.join('&') : '';
                }
                return _query;
            },
            set: function(value) {
                _uri = _url = _query = null;
                _parameters = {};
                var value = tools.string(value);
                var pairs = value.replace(/^\?+/, '').split('&');
                for (var i = pairs.length; i--;) {
                    var pair = pairs[i];
                    if (pair) {
                        var pos = pair.indexOf('=');
                        if (pos > -1) {
                            _parameters[pair.slice(0, pos)] = pair.slice(pos + 1);
                        } else {
                            _parameters[pair] = '';
                        }
                    }
                }
            },
            enumerable: true
        },
        parameters: {
            get: function() { _uri = _url = _query = null; return _parameters; },
            set: function(value) { _uri = _url = _query = null; _parameters = tools.object(value); },
            enumerable: true
        }
    });

    // timeout hook
    var _timeout_ms = 0;
    var _timeout_hd = 0;
    Object.defineProperty(this, 'timeout', {
        get: function() {
            return _timeout_ms;
        },
        set: function(ms) {
            _timeout_ms = ms;
            clearTimeout(_timeout_hd);
            if (_timeout_ms > 0) {
                _timeout_hd = setTimeout(function() {
                    self.service.metrics.requests['timed-out']++;
                    self.response.statusCode = 500;
                    Job.recycler.release(self, '--response timed-out: ' + _timeout_ms + 'ms--');
                }, _timeout_ms);
            }
        }
    });

    // trail mechanism
    var _trail = [];
    Object.defineProperty(this, 'trail', {
        get: function() {
            var text = util.format('%s - %s:%s - %s',
                                   self.client.ip, self.method,
                                   util.format('%d (%d bytes)',
                                               self.response.statusCode,
                                               self.request.connection.bytesWritten -
                                               self.request.connection.__jobStartBytesWritten),
                                   self.uri);
            if (cli.options.debug) {
                text += '\n--begin--\n' + _trail.join('\n') + '\n--end--\n';
            }
            return text;
        },
        set: function(value) {
            if (cli.options.debug) {
                if (value) {
                    _trail.push(tools.string(value));
                } else {
                    _trail = [];
                }
            }
        }
    });
};

/** Initialize a job object. */
Job.prototype.allocate = function(service, request, response) {

    // carrier
    var self = this;

    // internals
    this.trail = null;
    this.timeout = 30000;
    this.service = service;
    this.request = request;
    this.response = response;

    // populate properties
    var _peer        = this.request.connection.address();
    var _parts       = (this.request.headers['host'] || '').split(':');
    this.host        = (_parts[0] || _peer.address || '').toLowerCase();
    this.port        = parseInt(_parts[1] || _peer.port) || '';
    this.uri         = 'http' + (this.service.secure ? 's' : '') +
                       '://' + this.host + (this.port ? ':' + this.port : '') + request.url;
    this.method      = this.request.method;
    this.headers     = this.request.headers;
    this.client.ip   = this.request.connection.remoteAddress || '-',
    this.client.port = this.request.connection.remotePort || ''

    // indentify
    if (!this.service.hide) {
        this.response.setHeader('x-powered-by', this.service.powered);
        this.response.setHeader('server', this.service.title);
    }

    // configure connection
    this.request.connection.__job = this;
    this.request.connection.__jobStartBytesWritten = request.connection.bytesWritten;
};

/** Close a job object, performing required clean-up. */
Job.prototype.release = function() {

    // finish
    this.response.end();
    this.request.connection.__job = null;

    // analyze  
    log.say(this.trail);
    tools.increment(this.service.metrics.requests['by-status'], this.response.statusCode);
    tools.increment(this.service.metrics.requests['by-host'], this.host);

    // nullify object
    this.service = null;
    this.timeout = -1;
    this.trail = null;
    this.request = null;
    this.response = null;
};

/** Get/set an enumerable field from the Job object using the key name. */
Job.prototype.field = function(key, value) {
    var level = this;
    var parts = key.split('.');
    var depth = parts.length - 1;
    for (var i = 0; i < depth; i++) {
        if (parts[i] in level) {
            level = level[parts[i]];
        } else {
            return '';
        }
    }
    var type = tools.typeof(level[parts[depth]]);
    if (type === 'array' || type === 'object') {
        return '';
    }
    if (arguments.length > 1) {
        level[parts[depth]] = tools.string(value);
    }
    return tools.string(level[parts[depth]]);
};

/** Job recycler system. */
Job.recycler = new Recycler(Job, 'Job');

/** Exports. */
module.exports = Job;
