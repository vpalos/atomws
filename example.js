/** Service object. */
var service = {};

/** Service identity. Both are ignored if service.hide is true. Disable the favicon by setting it to null.
    Defaults are 'AtomWS' for title and '«atomws»/lib/files/favicon.ico' for the favicon. */
//service.title = 'AtomWS';
//service.favicon = global['ATOMWS_ROOT'] + '/lib/files/favicon.ico';

/** This value is the end-point where incoming client connections are accepted and it can be an 'ip:port'
    pair, a local-domain-socket file path or an array of such values.
    Default is '*:80' meaning bind to all interfaces on port 80. */
//service.bind = '*:80';

/** AtomWS serves a set of backend URLs (e.g. '/metrics') on a separate TCP/IP end-point which is specified 
    exactly as 'service.bind' but can also be null (i.e. off).
    Default is '127.0.0.1:81' meaning bind to localhost on port 81. */
//service.back = '127.0.0.1:81';

/** Hide the service identity from the clients.
    Default is false. */
//service.hide = false;

/** Number of workers to spawn for this service.
    Default is the number of CPU cores on the system. */
//service.workers = 2;

/** Chown running workers to these credentials (names or ids) after spawning.
    By default both are null, keeping the initial uid:gid (not recommended!). */
service.owner = 'www-data';
service.group = 'www-data';

/** The service routing structure.
    Defaults to an empty array (i.e. falls back to a 404 error). */
service.route = [
    {
        atom: 'alter',
        using: {
            'path': [ '^/status$', '/metrics' ],
        }
    },
    {
        atom: 'file',
        download: true,
        root: './tmp'
    },
    {
        atom: 'match:1',
        using: {
            'url!': [ '^/playerinfo$', '^/playerinfo/' ],
        },
        route: {
            atom: 'place:2',
            route: { 
                atom: 'jump', 
                to: ':target'
            }
        }
    },
    {
        atom: 'custom:target',
        prepare: function($) {
            this.__error_404 = this.atomize({ atom: 'error', code: 404 });
            $(true);
        },
        execute: function(job, $) {
            $(this.__error_404);
        }
    }
];

/** Exports. */
module.exports = service;
