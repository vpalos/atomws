/** AtomWS <http://atomws.org>.
    Copyright (C)2011 Valeriu Paloş <valeriu@palos.ro>. All rights reserved.
    GNU General Public License 3 <http://www.gnu.org/licenses/gpl-3.0.html>. */

/** Imports. */
var util = require('util');
var Recycler = require('./Recycler.js');

/** Internals. */
var __lapse = 5;
var __limit = [];
var __store = [];
var __stack = [];

/** Internal global periodic collector. */
var __timer = setInterval(function() {
    for (var i = __store.length >> 1; i--;) {
        var index = i << 1;
        if (__store[index] !== null) {
            var rate = __store[index] / __lapse;
            __store[index] = 0;
            __store[index + 1] = rate;
            if (__limit[i] < rate) {
                __limit[i] = rate;
            }
        }
    }
}, __lapse * 1000);

/** Time-moving averaging class. */
var Measure = function() {};

/** Initialize a new Measure object. */
Measure.prototype.allocate = function() {
    this.index = __stack.pop() || (__store.length >> 1);
    __limit[this.index] = 0;
    __store[(this.index << 1)] = 0;
    __store[(this.index << 1) + 1] = 0;
};

/** Recycle a used Measure object. */
Measure.prototype.release = function() {
    __limit[this.index] = null;
    __store[(this.index << 1) + 0] = null;
    __store[(this.index << 1) + 1] = null;
    __stack.push(this.index);
};

/** Add a new value to the set. */
Measure.prototype.add = function(value) {
    __store[this.index << 1] += value;
}

/** Produce a useful current value. */
Measure.prototype.value = function() {
    return Math.round(__store[(this.index << 1) + 1] * 1000) / 1000;
}

/** Produce a maximum value. */
Measure.prototype.maximum = function() {
    return Math.round(__limit[this.index] * 1000) / 1000;
}

/** Configure recycling system. */
Measure.recycler = new Recycler(Measure, 'Measure');

/** Measure exit cleanup. */
Measure.close = function() {
    __limit.length = 0;
    __store.length = 0;
    __stack.length = 0;
    clearInterval(__timer);
};
process.on('exit', Measure.close);

/** Exports. */
module.exports = Measure;
