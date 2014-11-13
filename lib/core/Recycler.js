/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Global counter. */
var __metrics = {};

/** Freelist-style object recycling system. */
var Recycler = function(klass, title, limit) {
    this.title = title || 'Object';
    this.limit = limit || 10000;
    this.stack = Array(this.limit);
    this.index = -1;
    this.klass = klass || Object;
};

/** Allocate an object from the freelist (if available). */
Recycler.prototype.allocate = function() {

    // initialise counter
    if (!__metrics[this.title]) {
        __metrics[this.title] = {
            created: 0,
            recycled: 0
        };
    }

    // spawn
    var object = null;
    if (this.index < 0) {

        // create new
        object = new this.klass();
        Object.defineProperty(object, '__Recycler_allocated', {
            value: true,
            configurable: false,
            enumerable: false,
            writable: true
        });

        // count
        __metrics[this.title]['created']++;
    } else {

        // pop from stack
        object = this.stack[this.index];
        this.stack[this.index--] = null;
        object.__Recycler_allocated = true;

        // count
        __metrics[this.title]['recycled']++;
    }

    // configure
    if (object.allocate) {
        object.allocate.apply(object, arguments);
    }

    // ready
    return object;
};

/** Collect an object into the freelist. */
Recycler.prototype.release = function() {

    // check if already released
    var object = arguments[0];
    if (object.__Recycler_allocated) {

        // check validity
        var values = Array.prototype.slice.call(arguments, 1);
        if (!(object instanceof this.klass)) {
            throw new Error('Wrong object type passed to Recycler!');
        }

        // un-configure
        object.__Recycler_allocated = false;
        if (object.release) {
            object.release.apply(object, values);
        }

        // push onto stack
        if (this.index < (this.limit - 1)) {
            this.stack[++this.index] = object;
        }
    }
};

/** Return counters. */
Recycler.metrics = function() {
    return __metrics;
};

/** Exports. */
module.exports = Recycler;
