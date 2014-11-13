/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var fs = require ('fs');
var path = require('path');
var util = require('util');
var log = require('../log.js');
var tools = require('../tools.js');

/** Parse a mime-type dictionary file. */
var import_mimes = function(file) {

    // memoize
    var cache = arguments.callee.__cache;
    if (tools.typeof(cache) !== 'object') {
        cache = arguments.callee.__cache = {};
    }
    if (!cache[file]) {
        cache[file] = {};

        // read file
        try {
            var lines = fs.readFileSync(file, 'ascii').split(/[\r\n]+/);
        } catch(e) {
            log.die("Failed to load mime types from file '%s'!", file);
        }

        // parse
        for (var item in lines) {
            var line = lines[item];
            var parts = line.match(/^\s*([^#\s]+)\s+([^\s].*[^\s])\s*$/);
            if (parts) {
                var types = parts[2].toLowerCase().split(/\s+/);
                for (var i = types.length; i--;){
                    cache[file][types[i]] = parts[1];
                }
            }
        }
    }

    // ready
    return cache[file];
};

/** Import system mime types. */
var system_mimes = import_mimes('/etc/mime.types');

/** Process job asynchronously. */
exports.execute = function(job, $) {

    // extract fields
    var download = this.field('download', job, false) ? 'attachment' : 'inline';
    var mimes = this.field('mimes', job, {});
    var root = path.resolve(this.field('root', job, '/var/www'));
    var encoding = this.field('encoding', job, 'utf-8');

    // safety check
    var self = this;
    fs.realpath(root + '/' + job.path, function(error, file) {

        // safety check
        if (error || file.indexOf(root) !== 0) {
            
            // failure
            $(true, util.format('--%s--', error || 'file outside root path'));
        } else {

            // target-file check
            fs.stat(file, function(error, stat) {

                // sanity checks
                if (error || !stat.isFile()) {
                    
                    // not found
                    $(true, util.format('--%s--', error || 'not a regular file'));
                } else {

                    // parse
                    var base = path.basename(file);
                    var type = path.extname(base).slice(1).toLowerCase();

                    // headers
                    job.response.writeHead(200, {
                        'content-type': (mimes[type] || system_mimes[type] || 'application/octet-stream') +
                                        '; charset=' + encoding,
                        'content-length': stat.size,
                        'content-disposition': download + '; filename=' + base + ';',
                        'modification-date': stat.mtime,
                    });

                    // ready
                    var input = fs.createReadStream(file);
                    input.on('end', function() {
                        $(false);
                    });
                    input.pipe(job.response);
                }
            });
        }
    });
};

