/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Options memoizer. */
exports.options = {};
exports.arguments = [];

/** Option definitions. */
var schema = [
    ['s', 'schema',  ':!', 'Path to server configuration schema.'],
    ['d', 'debug',   '',   'Enable debug-mode output verbosity (*only* for testing).'],
];

/** Command-line options parser (http://valeriu.palos.ro/1026). */
try {
    var tokens = [];
    var parts = process.argv;
    var count = parts.length;
    for (var i = 0, item = parts[0]; i < count; i++, item = parts[i]) {
        if (item.charAt(0) == '-') {
            if (item.charAt(1) == '-') {
                tokens.push('--', item.slice(2));
            } else {
                tokens = tokens.concat(item.split('').join('-').split('').slice(1));
            }
        } else {
            tokens.push(item);
        }
    }
    while (type = tokens.shift()) {
        if (type == '-' || type == '--') {
            var name = tokens.shift();
            if (name == 'help' || name == 'h') {
                throw 'help';
                continue;
            }
            var option = null;
            for (var i = 0, item = schema[0]; i < schema.length; i++, item = schema[i]) {
                if (item[type.length - 1] == name) {
                    option = item;
                    break;
                }
            }
            if (!option) {
                throw "Unknown option '" + type + name + "' encountered!";
            }
            var value = true;
            if ((option[2].indexOf(':') != -1) && !(value = tokens.shift())) {
                throw "Option '" + type + name + "' expects a parameter!";
            }
            var index = option[1] || option[0];
            if (option[2].indexOf('+') != -1) {
                exports.options[index] = exports.options[index] instanceof Array ?
                                         exports.options[index] : [];
                exports.options[index].push(value);
            } else {
                exports.options[index] = value;
            }
            if (typeof(option[4]) == 'function') {
                option[4](value);
            }
            option[2] = option[2].replace('!', '');
        } else {
            exports.arguments.push(type);
            continue;
        }
    }
    for (var i = 0, item = schema[0]; i < schema.length; i++, item = schema[i]) {
        if (item[2].indexOf('!') != -1) {
            throw "Option '" + (item[1] ? '--' + item[1] : '-' + item[0]) +
                  "' is mandatory and was not given!";
        }
    }
} catch(e) {
    if (e == 'help') {
        console.error(global['ATOMWS_CAPTION'] + ' web-service compiler (http://atomws.org).');
        console.error();
        console.error("Usage: %s «options» [«arguments»...]\n", process.title);
        for (var i = 0, item = schema[0]; i < schema.length; i++, item = schema[i]) {
            var names = (item[0] ? '-' + item[0] + (item[1] ? '|' : ''): '   ') +
                        (item[1] ? '--' + item[1] : '');
            var syntax = names + (item[2].indexOf(':') != -1 ? ' «value»' : '');
            syntax += syntax.length < 20 ? new Array(20 - syntax.length).join(' ') : '';
            console.error("     " + (item[2].indexOf('!') != -1 ? '*' : ' ')
                             + (item[2].indexOf('+') != -1 ? '+' : ' ')
                             + syntax + "\t" + item[3]);
        }
        console.error("\n    (* mandatory option)\n    (+ repeatable option)\n");
        process.exit(0);
    }
    console.error('%s\n%s', e, "Use  the '-h|--help' option for usage details.");
    process.exit(1);
}

