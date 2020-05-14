/**
 * Utility functions.
 * Util.dateChoices requires Moment.js.
 *
 * @author    Erki Suurjaak
 * @created   01.03.2015
 * @modified  14.05.2020
 */
"use strict";


/**
 * Returns the translation for the text, or same text if not found.
 * Configurable with Locale.init({text: translation, }).
 */
var Locale = new function(text) {

  var LocaleInner = function(text, args) {
    var result = (text in LocaleInner.dictionary) ? LocaleInner.dictionary[text] : text;
    var args = Array.apply(null, arguments).slice(1);
    if (args.length) result = result.format.apply(result, args);
    return result;
  };
  LocaleInner.dictionary = {}; // {text: translation}
  LocaleInner.init = function(trans) { LocaleInner.dictionary = trans; };

  return LocaleInner;
};
var _ = Locale;


/** Adds basic numeric strftime formatting to JavaScript Date, UTC time. */
Date.prototype.strftime = function(format) {
  var result = format.replace(/%%/g, "~~~~~~~~~~"); // Temp-replace literal %
  var x = this;
  var FMTERS = {
    "%d": function() { return String(x.getUTCDate()).ljust(2, "0"); },
    "%m": function() { return String(x.getUTCMonth() + 1).ljust(2, "0"); },
    "%y": function() { return String(x.getUTCFullYear() % 100).ljust(2, "0").slice(-2); },
    "%Y": function() { return String(x.getUTCFullYear()).rjust(4, "0"); },
    "%H": function() { return String(x.getUTCHours()).ljust(2, "0"); },
    "%I": function() { var h = x.getUTCHours(); return String(h > 12 ? h - 12 : h).ljust(2, "0"); },
    "%M": function() { return String(x.getUTCMinutes()).ljust(2, "0"); },
    "%S": function() { return String(x.getUTCSeconds()).ljust(2, "0"); },
    "%f": function() { return String(x.getUTCMilliseconds()).rjust(3, "0").ljust(6, "0"); },
    "%w": function() { return x.getUTCDay(); },
    "%W": function() { return String(Util.weekOfYear(x)).ljust(2, "0"); },
    "%p": function() { return (x.getUTCHours() < 12) ? "AM" : "PM"; },
    "%P": function() { return (x.getUTCHours() < 12) ? "am" : "pm"; },
  };
  for (var f in FMTERS) result = result.replace(new RegExp(f, "g"), FMTERS[f]);
  return result.replace(/~~~~~~~~~~/g, "%"); // Restore literal %-s
};


/**
 * Adds positional formatting with {#index}-parameters to JavaScript String.
 * Function parameters are invoked as String.replace function argument.
 * @from http://stackoverflow.com/questions/1038746/equivalent-of-string-format-in-jquery
 */
String.prototype.format = String.prototype.f = function() {
    var s = this, i = arguments.length;
    while (i--) s = s.replace(new RegExp("\\{" + i + "\\}", "g"), arguments[i]);
    return s;
};


/** Adds right-justifying to JavaScript String. */
String.prototype.rjust = function(len, char) {
  len = this.length < len ? len - this.length : 0;
  char = char || " ";
  return String(this + Array(len+1).join(char));
};


/** Adds left-justifying to JavaScript String. */
String.prototype.ljust = function(len, char) {
  len = this.length < len ? len - this.length : 0;
  char = char || " ";
  return String(Array(len+1).join(char) + this);
};


/** Capitalizes the first letter of the string. */
String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};


/** Returns a positive hash of the string */
String.prototype.hashCode = function() {
    var hash = 0, i = 0, len = this.length;
    while (i < len) hash = ((hash << 5) - hash + this.charCodeAt(i++)) << 0;
    return (hash + 2147483647) + 1;
};


var Util = new function() {
  var self = this;


  /** Returns whether value is a string. */
  self.isString = function(value) {
    return (typeof value === "string" || value instanceof String);
  };


  /** Returns whether the value represents a valid number. */
  self.isNumeric = function(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  };


  /** Returns whether value is a DOM element like <div> or Nodelist. */
  self.isDOM = function(value) {
    var TYPES = "Node" in window ? [Node, NodeList, HTMLCollection] : [];
    return TYPES.some(function(x) { return value instanceof x; });
  };


  /** Returns whether value is a dictionary object. */
  self.isDict = function(v) {
    return (typeof(v) === "object") && (v !== null) && !(v instanceof Array) && !(v instanceof Date);
  };


  /**
   * Returns whether value is empty (falsy): Boolean false, Number 0,
   * string "", object {} or array [].
   */
  self.isEmpty = function(v) {
    var result = !Boolean(v);
    if (!result && Array.isArray(v)) result = !v.length;
    else if (!result && Util.isDict(v)) result = !Object.keys(v).length;
    return result;
  };


  /** Returns the angle in radians. */
  self.radians = function(angle) {
    return angle * Math.PI / 180;
  };


  /** Returns an incremental counter for specified name. */
  self.counter = new function(name) {
    var counters = {};
    return function(name) {
      counters[name] = (counters[name] || 0) + 1;
      return counters[name];
    };
  };


  /** Returns an incremental ID "prefix-count". */
  self.uniqueID = new function(prefix) {
    var indexes = {};
    return function(prefix) {
      prefix = (typeof(prefix) === "undefined") ? "" : prefix;
      indexes[prefix] = indexes[prefix] || 0;
      return "{0}-{1}".format(prefix, ++indexes[prefix]);
    };
  };


  /**
   * Returns the value of the specified collection path, or undefined if not present.
   * Collection can be a nested structure of dicts, arrays or strings.
   * E.g. Util.get({"root": {"first": [{"k": "v"}]}}, "root", "first", 0, "k").
   * Supports negative indexes for arrays and strings.
   */
  self.get = function(collection, path/*, path, .. */) {
    var result = (undefined !== path) ? collection : undefined;
    path = (arguments.length > 2) ? Array.apply(null, arguments).slice(1)
           : Array.isArray(path) ? path : [path];

    for (var i = 0; i < path.length; i++) {
      var p = path[i];
      if ((Array.isArray(result) || self.isString(result)) && typeof(p) === "number" && !isNaN(p)) {
        if (p < 0) p = result.length + p;
        result = result[p];
      } else if (result && "object" === typeof(result))
        result = result[p];
      else
        result = undefined;
      if (undefined === result) break; // for i
    };
    return result;
  };


  /**
   * Sets the value to object (or array) at specified path. If path does not
   * exist, creates it as dictionaries. Returns original object.
   * Util.set({}, 42, "a", "b", "c") == {a: {b: {c: 42}}}.
   */
  self.set = function(obj, value, path/*, path, .. */) {
    path = (arguments.length > 3) ? Array.apply(null, arguments).slice(2)
           : Array.isArray(path) ? path : [path];
    for (var i = 0, ptr = obj; i < path.length - 1; i++) {
      ptr[path[i]] = (ptr[path[i]] instanceof Object) ? ptr[path[i]] : {};
      ptr = ptr[path[i]];
    };
    ptr[path[path.length-1]] = value;
    return obj;
  };


  /**
   * Returns the first non-falsy item property by any specified name.
   * If item is a list, returns a list of values, one from each element.
   */
  self.lookup = function(item, name/*, name, .. */) {
    var names = (arguments.length > 2) ? Array.apply(null, arguments).slice(1)
                : Array.isArray(name) ? name : [name];
    var result = Array.isArray(item) ? [] : undefined;
    var list = Array.isArray(item) ? item : [item];
    for (var i = 0; i < list.length; i++) {
      var value = undefined;
      for (var j = 0; j < names.length; j++) {
        value = list[i][names[j]];
        if (value) break; // for var j
      };
      if (Array.isArray(result)) result.push(value); else result = value;
    };
    return result;
  };


  /** Returns a new array of unique elements, in original order. */
  self.arrayUnique = function(array) {
    var unique = [];
    for (var i = 0; i < array.length; i++)
      if (unique.indexOf(array[i]) < 0)
        unique.push(array[i]);
    return unique;
  };


  /** Returns the intersection of two arrays, or of keys of two objects. */
  self.intersect = function(array1, array2) {
    array1 = Array.isArray(array1) ? array1 : Object.keys(array1 || {});
    array2 = Array.isArray(array2) ? array2 : Object.keys(array2 || {});
    return array1.filter(function(item) { return array2.indexOf(item) >= 0; });
  };


  /**
   * Returns the intersection of two arrays, or of keys of two objects,
   * with each duplicate item in array2 counted only once.
   */
  self.intersectUnique = function(array1, array2) {
    array1 = Array.isArray(array1) ? array1 : Object.keys(array1 || {});
    array2 = Array.isArray(array2) ? array2 : Object.keys(array2 || {});

    var idxs = {}; // {array1 index: array2 index found}
    return array1.filter(function(item, i) {
      var j = array2.indexOf(item, (i in idxs) ? idxs[i] + 1 : 0);
      idxs[i] = j;
      return j >= 0;
    });
  };


  /** Returns the difference of two arrays, or of keys of two objects. */
  self.difference = function(array1, array2) {
    array1 = Array.isArray(array1) ? array1 : Object.keys(array1 || {});
    array2 = Array.isArray(array2) ? array2 : Object.keys(array2 || {});
    return array1.filter(function(item) { return array2.indexOf(item) < 0; });
  };


  /** Comparator function for numeric values. */
  self.cmpNumbers = function(a, b) { return a - b; };


  /** Comparator function for string values. */
  self.cmpStrings = function(a, b) { return String(a).localeCompare(String(b)); };


  /**
   * Returns a new array of objects sorted by specified field.
   * Number values are sorted numerically, string values are sorted
   * case-insensitively with numeric collation ("1" < "2" < "10").
   *
   * @param   fields  field name, or a list of field names
   * @param   orders  sort order, or a list of sort orders, default true=ascending
   * @param   format  object field value formatting function, if any,
   *                  called with (field value, field name, item)
   * @param   cmp     value compare function, if not using default, returns -1 0 1
   */
  self.sortObjects = function(array, fields, orders, format, cmp) {
    if (array.length < 2) return array.slice();
    fields = Array.isArray(fields) ? fields : [fields];
    orders = Array.isArray(orders) ? orders : [orders === undefined ? true : orders];
    if (orders.length < fields.length) // Pad orders to fields length with trues
      orders = orders.concat("".ljust(fields.length - orders.length, 1).split("").map(Boolean));

    cmp = cmp || function(a, b) { return (self.isString(a) || self.isString(b)) ? self.cmpStrings(a, b) : self.cmpNumbers(a, b); };
    return array.slice().sort(function(a, b) {
      var result = 0;
      for (var i = 0; i < fields.length; i++) {
        var aval = a[fields[i]], bval = b[fields[i]];
        if (format)
          aval = format(aval, fields[i], a), bval = format(bval, fields[i], b);
        var cmpval = cmp(aval, bval);
        result = cmpval ? (orders[i] ^ (cmpval < 0) ? 1 : -1) : 0;
        if (result) break; // for i
      };
      return result;
    });
  };


  /** Returns a list of object attribute values. */
  self.objectValues = function(obj) {
    var result = [], keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) result.push(obj[keys[i]]);
    return result;
  };


  /**
   * Returns a new object with all of the members of this object
   * for which the provided filtering function returns true,
   * or which match a name in the provided list of member names.
   *
   * @param   filter  function(value, key, object) or [key1, key2, ..]
   */
  self.objectFilter = function(obj, filter) {
    var result = {};
    if (Array.isArray(filter)) for (var i = 0; i < filter.length; i++) {
      if (filter[i] in obj) result[filter[i]] = obj[filter[i]];
    } else for (var i = 0, kk = Object.keys(obj); i < kk.length; i++) {
      if (filter(obj[kk[i]], kk[i], obj)) result[kk[i]] = obj[kk[i]];
    };
    return result;
  };


  /**
   * Returns whether the two values are equal. If the values are objects, returns
   * whether they have equal keys and values. If the values are arrays, returns
   * whether their elements are equal.
   */
  self.equals = function(v1, v2) {
    if (v1 === v2) return true;
    if ([v1, v2].every(Array.isArray)) {
      if (v1.length !== v2.length) return false;
      for (var i = 0; i < v1.length; i++) if (!self.equals(v1[i], v2[i])) return false;
    } else if (v1 instanceof Object && v2 instanceof Object) {
      var k1 = Object.keys(v1), k2 = Object.keys(v2);
      if (k1.length !== k2.length) return false;
      for (var i = 0; i < k1.length; i++) if (k1[i] !== k2[i]) return false;
      for (var i = 0; i < k1.length; i++) if (!self.equals(v1[k1[i]], v2[k1[i]])) return false;
    } else return false;
    return true;
  };


  /**
   * Returns an object constructed from an array of consecutive keys and values,
   * or from an array of keys and an array of values,
   * or from all arguments as consecutive keys and values.
   * (["x", 0, "y", 1]) == (["x", "y"], [0, 1]) == ("x", 0, "y", 1)
   */
  self.object = function(array) {
    var result = {};
    if (1 == arguments.length)
      for (var i = 0; i < array.length; i += 2)
        result[array[i]] = array[i + 1];
    else if (2 == arguments.length && Array.apply(null, arguments).every(Array.isArray))
      for (var i = 0; i < arguments[0].length; i++)
        result[arguments[0][i]] = arguments[1][i];
    else
      for (var i = 0; i < arguments.length; i += 2)
        result[arguments[i]] = arguments[i + 1];
    return result;
  };


  /**
   * Returns a shallow copy of the argument object, or a new array if array,
   * or the argument itself if not an object.
   */
  self.clone = function(obj) {
    if (!(obj instanceof Object)) return obj;
    if (Array.isArray(obj)) return obj.slice();
    if (obj instanceof Date) return new Date(obj);
    var result = {};
    for (var i = 0, keys = Object.keys(obj); i < keys.length; i++)
      result[keys[i]] = obj[keys[i]];
    return result;
  };


  /**
   * Returns a deep copy of the argument, or a new deeply copied array if array,
   * or the argument itself if not an object.
   */
  self.deepclone = function(obj) {
    if (obj instanceof Function || !(obj instanceof Object)) return obj;
    if (obj instanceof Date) return new Date(obj);
    if (Array.isArray(obj)) return obj.map(self.deepclone);
    var result = {};
    for (var i = 0, keys = Object.keys(obj); i < keys.length; i++)
      result[keys[i]] = self.deepclone(obj[keys[i]]);
    return result;
  };


  /** Merges two or more objects into a new object. */
  self.merge = function(a, b/*, c, .. */) {
    var objkeys = function(x) { // Objects can have defined properties
      var kk = Object.keys(x);
      return (kk.length ? kk : Object.keys(Object.getPrototypeOf(x)));
    };
    var o0 = objkeys(a || {}).reduce(function(o, k) { o[k] = a[k]; return o; }, {});
    return Array.apply(null, arguments).slice(1).reduce(function(a, b) {
      return objkeys(b || {}).reduce(function(o, k) { o[k] = b[k]; return o; }, a);
    }, o0);
  };


  /**
   * Merges two or more objects into a new object, dictionaries and arrays
   * are merged recursively.
   */
  self.merge_recursive = function(a, b/*, c, .. */) {
    var objkeys = function(x) { // Objects can have defined properties
      var kk = Array.isArray(x) ? self.range(x.length) : Object.keys(x);
      return (kk.length ? kk : Object.keys(Object.getPrototypeOf(x)));
    };
    var ctor = function(x) { return (x && x.constructor) ?  x.constructor() : {}; };
    var o0 = objkeys(a || {}).reduce(function(o, k) { o[k] = a[k]; return o; }, ctor(a));
    return Array.apply(null, arguments).slice(1).reduce(function(a, b) {
      return objkeys(b || {}).reduce(function(o, k) {
        var recurse = (o[k] !== b[k]) && ([o[k], b[k]].every(self.isDict) || [o[k], b[k]].every(Array.isArray));
        o[k] = recurse ? self.merge_recursive(o[k], b[k]) : b[k];
        return o;
      }, a);
    }, o0);
  };


  /** Merges one or more objects into the first object, returns first object. */
  self.update = function(a, b/*, c, .. */) {
    var objkeys = function(x) { // Objects can have defined properties
      var kk = x ? Object.keys(x) : [];
      return (kk.length ? kk : x ? Object.keys(Object.getPrototypeOf(x)) : kk);
    };
    for (var i = 1; i < arguments.length; i++) {
      var keys = objkeys(arguments[i] || {});
      for (var j = 0; j < keys.length; j++) a[keys[j]] = arguments[i][keys[j]];
    };
    return a;
  };


  /** Recursively merges one or more objects into the first object, returns first object. */
  self.update_recursive = function(a, b/*, c, .. */) {
    var objkeys = function(x) { // Objects can have defined properties
      var kk = x ? Object.keys(x) : [];
      return (kk.length ? kk : x ? Object.keys(Object.getPrototypeOf(x)) : kk);
    };
    return Array.apply(null, arguments).slice(1).reduce(function(a, b) {
      return objkeys(b || {}).reduce(function(o, k) {
        var recurse = (o[k] !== b[k]) && ([o[k], b[k]].every(self.isDict) || [o[k], b[k]].every(Array.isArray));
        o[k] = recurse ? self.update_recursive(o[k], b[k]) : b[k];
        return o;
      }, a);
    }, a);
  };


  /** Deletes the named object attribute and returns its value or default if not set. */
  self.pop = function(obj, name, defaultval) {
    var result = defaultval;
    if (name in obj) {
      result = obj[name];
      delete obj[name];
    };
    return result;
  };


  /**
   * Returns a new object with the same keys as the specified object, and values
   * provided by given function.
   *
   * @param   factory  function to invoke with (key, value), or static value
   */
  self.objectMap = function(obj, factory) {
    var ctor = (factory instanceof Function) ? factory : function() { return factory; };
    return Object.keys(obj).reduce(function(o, v) { o[v] = ctor(v, obj[v]); return o; }, {});
  };


  /**
   * Returns function(value), returning whether value matches all words in search text.
   */
  self.makeTextFilter = function(text) {
    var words = String(text).split(/\s/g).filter(Boolean);
    var regexes = words.map(function(word) { return new RegExp(Util.escapeRegExp(word), "i"); });
    return function(value) { return regexes.every(function(r) { return String(value).match(r); }); };
  };


  /** Returns the word as 'count words', or '1 word' if count is 1. */
  self.plural = function(word, items) {
    var count = (items && undefined != items.length) ? items.length : items || 0;
    var result = "{0} {1}{2}".format(count, word, 1 == Math.abs(count) ? "" : "s");
    return result
  };


  /** Returns a list of integers, from 0:N-1, or start:stop-1. */
  self.range = function(start, stop) {
    if (undefined === stop) stop = start, start = 0;
    return Array.apply(null, Array(stop - start)).map(function(_, i) { return start + i; });
  };


  /** Escapes &<>"'/ with HTML entities. */
  self.escapeHtml = function(string) {
    var entityMap = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': '&quot;',
                     "'": '&#39;', "/": '&#x2F;' };
    return String(string).replace(/[&<>"'\/]/g, function (s) {
      return entityMap[s];
    });
  };


  /** Escapes special characters in a string for RegExp. */
  self.escapeRegExp = function(string) {
    return string.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, "\\$&");
  };


  /** Returns [latitude, longitude] from list or dictionary, or null. */
  self.getLatLng = function(data) {
    var result = null;
    if (!data) return result;
    if (data.lat != null && data.lng != null) {
      result = [data.lat, data.lng];
    } else if (data.latitude != null && data.longitude != null) {
      result = [data.latitude, data.longitude];
    } else if (Array.isArray(data) && data.length > 1) {
      result = data.slice(0, 2)
    } else if ("area" == data.type && data.points && data.points.length) {
      result = data.points;
    }
    return result;
  };


  /**
   * Returns the distance from 'this' point to destination point (using haversine formula).
   *
   * @param   {LatLon} point - Latitude/longitude of destination point.
   * @param   {number} [radius=6371e3] - (Mean) radius of earth (defaults to radius in metres).
   * @returns {number} Distance between this point and destination point, in same units as radius.
   *
   * @example
   *     var p1 = new LatLon(52.205, 0.119), p2 = new LatLon(48.857, 2.351);
   *     var d = p1.distanceTo(p2); // Number(d.toPrecision(4)): 404300
   * @from   http://www.movable-type.co.uk/scripts/latlong.html
   */
  self.getLatLngDistance = function(p1, p2) {
      p1 = self.getLatLng(p1), p2 = self.getLatLng(p2);
      var R = 6371e3; // Mean radius of Earth in meters
      var lat1 = self.radians(p1[0]), lng1 = self.radians(p1[1]);
      var lat2 = self.radians(p2[0]), lng2 = self.radians(p2[1]);
      var latDelta = lat2 - lat1;
      var lngDelta = lng2 - lng1;

      var a = Math.sin(latDelta/2) * Math.sin(latDelta/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(lngDelta/2) * Math.sin(lngDelta/2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      var d = R * c;
      return d;
  };


  /** Formats a latitude-longitude tuple or object as "[59.430421, 24.581992]". */
  self.fmtLatLng = function(latlng, start, end, mid) {
    if (!latlng) return "";
    latlng = latlng.length ? latlng : [latlng.lat, latlng.lng];
    start = "undefined" === typeof(start) ? "[" : start;
    mid = "undefined" === typeof(mid) ? ", " : mid;
    end = "undefined" === typeof(end) ? "]" : end;
    try { return "{0}{1}{2}{3}{4}".format(start, latlng[0].toFixed(6),
                 mid, latlng[1].toFixed(6), end);
    } catch (e) {
      try { return start + latlng[0] + mid + latlng[1] + end; }
      catch (e) { return "[" + latlng + "]"; }
    }
  };


  /** Returns a date for the specified day of year, by default current year. */
  self.dateFromDay = function(day, year) {
    var date = new Date(year || (new Date()).getFullYear(), 0);
    return new Date(date.setDate(day));
  };


  /** Returns date's UTC time as floating-point hours. */
  self.dateHours = function(dt) {
    return dt.getUTCHours() + dt.getUTCMinutes() / 60 + dt.getUTCSeconds() / 3600;
  };


  /** Returns date and time (as seconds) combined. */
  self.dateCombine = function(dt, t) {
    var dt2 = new Date(dt);
    var hh = Math.floor(t / 3600),
        mm = Math.floor((t - hh * 3600) / 60),
        ss = Math.floor(t % 60),
        ms = Math.floor(t % 1 * 1000);
    dt2.setHours(hh), dt2.setMinutes(mm), dt2.setSeconds(ss), dt2.setMilliseconds(ms);
    return dt2;
  };


  /** Returns the day of the year for the specified date or current date. */
  self.dayOfYear = function(dt) {
    dt = dt || new Date();
    return Math.round((new Date(dt).setHours(23) - new Date(dt.getYear()+1900, 0, 1, 0, 0, 0))/1000/60/60/24);
  };


  /** Returns the week of the year for the specified date or current date. */
  self.weekOfYear = function(dt) {
    var dt = dt || new Date();
    dt.setHours(0, 0, 0, 0);
    dt.setDate(dt.getDate() + 4 - (dt.getDay() || 7));
    return Math.ceil((((dt - new Date(dt.getFullYear(), 0, 1)) / 86400000) + 1) / 7);
  };


  /**
   * Format floating-point hour as %H:%M.
   * If mm is given, uses that for minutes instead of hour fractions.
   * If hh is a dictionary, it is expected to have one or more of "hh", "mm", "ss".
   */
  self.formatHours = function(hh, mm) {
    if (self.isDict(hh)) {
      mm = (hh.mm != null) ? hh.mm : 0;
      var ss = (hh.ss != null) ? hh.ss : 0;
      hh = (hh.hh != null) ? hh.hh : 0;
      if (hh < 0 || mm < 0 || ss < 0) return "XX:XX";
      if ([hh, mm, ss].some(isNaN)) return "XX:XX";
      if (ss >= 60) {
        mm = parseInt(ss / 60);
        ss %= 60;
      };
      if (mm >= 60) {
        hh = parseInt(mm / 60);
        mm %= 60;
      };
    } else {
      if (isNaN(hh) || hh < 0) return "XX:XX";
      mm = (mm != null) ? mm : hh % 1 * 60;
    };

    return [hh, mm].map(function(x) { return parseInt(x, 10).toString().ljust(2, "0"); }).join(":");
  };


  self.formatBytes = function(size, precision, inter) {
    /**
     * Returns a formatted byte size (e.g. 421.45 MB).
     *
     * @param   precision  places after comma, default 2
     * @param   inter      text between number and unit, default " "
     */
    var result = "0 bytes";
    var precision = (undefined !== precision) ? precision : 2;
    var inter = (undefined !== inter) ? inter : " ";

    if (size) {
      var UNITS = [1 == size ? "byte" : "bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
      var exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), UNITS.length - 1);

      result = "" + Number(size / Math.pow(1024, exponent)).toFixed(precision);
      result += (precision > 0) ? "" : "."; // Do not strip integer zeroes
      result = result.replace(/0+$/g, "").replace(/\.+$/g, "") + inter + UNITS[exponent];
    };
    return result;
  };


  /**
   * Returns a list of datetimes, evenly spaced from the range of dates given.
   *
   * @param   opts  {width: pixels to fit formatted dates into,
   *                 timezone: timezone for datetime arithmetic, defaults to "UTC"
   *                 formats: {week, date, hour},
   *                 interval: default interval unit like "week"}
   */
  self.dateChoices = function(dates, opts) {
    var result = [];
    if (!dates || !dates.length) return result;

    dates = dates.slice().sort(Util.cmpNumbers);
    opts = self.merge_recursive({formats: {week: "week #%W", date: "%Y-%m-%d", "hour": "%H:%M"}, timezone: "UTC"}, opts);
    var delta = moment.duration(moment(dates[dates.length - 1]).diff(dates[0]));
    var fmt = ("week" == opts.interval) ? opts.formats.week : (delta.asDays() < 2) ? opts.formats.hour : opts.formats.date;
    var myunit = opts.interval || (delta.asDays() < 2 ? "hour" : "day");
    var startunit = ("week" == opts.interval) ? "isoWeek" : myunit;
    var len = self.getTextWidth(dates[0].strftime(fmt));
    var count = opts.width ? Math.ceil(opts.width / (2 * len)) : 4;

    var d1 = moment.tz(dates[0], opts.timezone).add(1, "minute").startOf(startunit).toDate();
    var d2 = moment.tz(dates[dates.length - 1], opts.timezone).startOf(startunit).toDate();
    var step = (d2 - d1) / (count - 1);

    result = [d1].concat(self.range(1, count - 1).map(function(i) {
      return moment.tz(d1, opts.timezone).add(i * step).startOf(startunit).toDate();
    })).concat([d2]);
    var formatted = {};
    var uniquefmt = ("hour" == myunit) ? "%Y%m%d " + fmt : fmt;
    var MOMENT_FMTS = {"%Y": "Y", "%m": "MM", "%d": "DD", "%H": "HH", "%M": "mm", "%S": "ss", "%W": "WW", "%I": "hh", "%p": "A"};
    var momentfmt = uniquefmt.replace(/(%\w)|(\w+)/gi, function(_, a, b) { return a ? MOMENT_FMTS[a] : "[{0}]".format(b); });
    result = result.filter(function(x) {
      var str = moment.tz(x, opts.timezone).format(momentfmt);
      return (str in formatted) || (formatted[str] = true);
    });
    if (result.length < 2 && dates.length > 1) result = [d1, d2];
    return result;
  };


  /**
   * Makes an AJAX query. Can use callback chaining,
   * as ajax({opts}).success(func).error(func).complete(func).
   *
   * @param   options  {url, data, method, success, error, complete}
   */
  self.ajax = function(options) {
    var request = new XMLHttpRequest();
    options = self.clone(options);

    request.onload = function() {
      if (request.status >= 200 && request.status < 400) {
        if (options.success) options.success(request.responseText);
      } else {
        if (options.error) options.error(request);
      };
      if (options.complete) options.complete();
    };

    request.onerror = function(e) {
      if (options.error) options.error(request);
      if (options.complete) options.complete();
    };

    var url = options.url;
    if ("GET" == options.method && options.data)
      url += "?" + (self.isString(options.data) ? options.data : self.serialize(options.data));

    request.open(options.method || "POST", url, true);
    if (!options.method || "POST" == options.method)
      request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
    if ("GET" == options.method) request.send();
    else request.send(self.isString(options.data) || (options.data instanceof FormData) ? options.data : JSON.stringify(options.data));

    var chainer = {
      success:  function(callback) { options.success  = callback; return chainer; },
      error:    function(callback) { options.error    = callback; return chainer; },
      complete: function(callback) { options.complete = callback; return chainer; },
    };
    return chainer;
  };


  /** Parses the string as JSON data, ISO8601 strings auto-converted to dates. */
  self.jsonLoad = function(string) {
    var reISO = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2}(?:\.\d*)*)(?:Z|(\+|-)([\d|:]*))?$/;
    return JSON.parse(string, function(key, value) {
      return (self.isString(value) && reISO.exec(value)) ? new Date(value) : value;
    });
  };


  /** Returns the string as date object, or as original value if unparseable. */
  self.parseDate = function(value) {
    if (value instanceof Date || !self.isString(value)) return value;
    var reISO = /^(\d{4})-(\d{2})-(\d{2})([ T](\d{2}):(\d{2}):(\d{2}(?:\.\d*)*)(?:Z|(\+|-)([\d|:]*))?)?$/;
    return reISO.exec(value) ? new Date(value) : value;
  };


  /** Converts an object into a query string. */
  self.serialize = function(obj, prefix) {
    var str = [];
    for (var p in obj) {
      if (obj.hasOwnProperty(p)) {
        var k = prefix || p, v = obj[p];
        if (v instanceof Date) v = v.toISOString();
        str.push(typeof v == "object" ? self.serialize(v, k) :
          encodeURIComponent(k) + "=" + encodeURIComponent(v));
      };
    };
    return str.filter(Boolean).join("&");
  };


  /**
   * Registers a decorator function on specified object method. Original
   * function will be shadowed, and invokation will call decorating function
   * first, giving the original function as first argument.
   * Further decoratings shadow the previous ones, stacking earlier decorator
   * as the original given to later one.
   * 
   * @param   object   existing object instance
   * @param   name     name of object method to decorate,
   *                   or {name1: handler1, name2: handler2}
   * @param   handler  function decorating object.name, given original function
   *                   as first argument
   */
  self.decorate = function(object, name, handler) {

    /**
     * Wrapper function set to object, invokes wrapped function with original
     * as first argument, returns result.
     */
    var mywrapper = function(object, func, originalfunc, args/*, args, .. */) {
      return func.apply(object, Array.apply(null, arguments).slice(2));
    };

    var opts = self.isDict(name) ? name : self.object(name, handler);
    Object.keys(opts).forEach(function(name) {
      object[name] = mywrapper.bind(self, object, opts[name], object[name])
    });
  };


  /**
   * Returns image size in given callback function(url, function(w, h)).
   * Caches already retrieved sizes.
   */
  self.imageSize = new function(url, callback) {
    var cache = {}; // {url: [w, h], }

    return function(url, callback) {
      if (url in cache) return callback.apply(null, cache[url]);
      var img = new Image();
      img.addEventListener("load", function(evt) {
        cache[url] = [evt.target.width, evt.target.height];
        callback.apply(null, cache[url]);
      });
      img.src = url;
    };
  };


  /**
   * Adds a new CSS class to the document.
   *
   * @param   selector  CSS selector, like "div.myclass > span.mychild"
   * @param   rules     "property: value; property: value;"
   *                    or ["property: value", ] or {property: value, }
   */
  self.createCSSClass = function(selector, rules){
    var style = document.createElement("style");
    style.type = "text/css";
    rules = self.isString(rules) ? rules : Array.isArray(rules) ? rules.join(";")
            : Object.keys(rules).map(function(x) { return x + ": " + rules[x]; }).join(";");
    style.innerHTML = selector + "{" + rules + "}";
    document.getElementsByTagName("head")[0].appendChild(style);
  };


  /**
   * Adds a number of new CSS classes to the document.
   *
   * @param   rulemap  {selector: "rules" or ["rule", ] or {name: value}, }
   */
  self.createCSSClasses = function(rulemap) {
    if (!Object.keys(rulemap).length) return;
    var style = document.createElement("style");
    style.type = "text/css";
    self.objectMap(rulemap, function(k, v) {
      v = self.isString(v) ? v : Array.isArray(v) ? v.join(";")
          : Object.keys(v).map(function(x) { return x + ": " + v[x]; }).join(";");
      style.innerHTML += k + " {" + v + "}";
    });
    document.getElementsByTagName("head")[0].appendChild(style);
  };


  /** Returns a value suitable for use as a CSS identifier. */
  self.escapeCSSName = function(name) {
    return encodeURIComponent(name).replace(/[^a-z0-9-_]/ig, function(x) { return btoa(x).replace(/=/g, "__"); });
  };


  /** @from https://github.com/mzabriskie/react-draggable */
	self.outerHeight = function(node) {
	  // This is deliberately excluding margin for our calculations, since we are using
	  // offsetTop which is including margin. See getBoundPosition
	  var height = node.clientHeight;
	  var computedStyle = window.getComputedStyle(node);
	  height += parseInt(computedStyle.borderTopWidth, 10);
	  height += parseInt(computedStyle.borderBottomWidth, 10);
    height += parseInt(computedStyle.marginTop, 10);
    height += parseInt(computedStyle.marginBottom, 10);
	  return height;
	};


	self.outerWidth = function(node) {
	  // This is deliberately excluding margin for our calculations, since we are using
	  // offsetLeft which is including margin. See getBoundPosition
	  var width = node.clientWidth;
	  var computedStyle = window.getComputedStyle(node);
	  width += parseInt(computedStyle.borderLeftWidth, 10);
	  width += parseInt(computedStyle.borderRightWidth, 10);
    width += parseInt(computedStyle.marginLeft, 10);
    width += parseInt(computedStyle.marginRight, 10);
	  return width;
	};


	self.innerHeight = function(node) {
	  var height = node.clientHeight;
	  var computedStyle = window.getComputedStyle(node);
	  height -= parseInt(computedStyle.paddingTop, 10);
	  height -= parseInt(computedStyle.paddingBottom, 10);
	  return height;
	};


	self.innerWidth = function(node) {
	  var width = node.clientWidth;
	  var computedStyle = window.getComputedStyle(node);
	  width -= parseInt(computedStyle.paddingLeft, 10);
	  width -= parseInt(computedStyle.paddingRight, 10);
	  return width;
	};


  /**
   * Returns the pixel width of the text, using canvas.measureText.
   * 
   * @param   text  the text to measure
   * @param   font  CSS font descriptor to render text with, e.g. "bold 14px verdana"
   */
  self.getTextWidth = function(text, font) {
    self.getTextWidth.canvas = self.getTextWidth.canvas || document.createElement("canvas");
    self.getTextWidth.cache = self.getTextWidth.cache || {};
    if ([text, font] in self.getTextWidth.cache) return self.getTextWidth.cache[[text, font]];
    var context = self.getTextWidth.canvas.getContext("2d");
    if (font) context.font = font;
    return (self.getTextWidth.cache[[text, font]] = Math.ceil(context.measureText(text).width));
  };


  /** Returns a new DOM tag, with specified HTML attributes and inner HTML (or node collection). */
  self.createElement = function(name, attr, html) {
    var result = document.createElement(name);
    if (html) {
      if (Util.isString(html)) result.innerHTML = html;
      else if (Array.isArray(html)) html.forEach(function(x) {
        if (Util.isString(x)) result.append(x, document.createTextNode(" "));
        else result.append(x);
      }); else if (html != null) result.append(html);
    };
    Object.keys(attr || {}).forEach(function(x) {
      if (x.startsWith("on")) result[x] = attr[x];
      else result.setAttribute(x, attr[x]);
    });
    return result;
  };


  /** Returns current selected text range, as {node, start, end}. */
  self.getSelection = function() {
    var sel = window.getSelection && window.getSelection();
    if (sel && sel.getRangeAt && sel.rangeCount) {
      var range = sel.getRangeAt(0);
      return {node: sel.anchorNode, start: range.startOffset, end: range.endOffset};
    };
  };


  /** Restores selected text as returned from getSelection. */
  self.restoreSelection = function(opts) {
    if (!opts || !window.getSelection) return;
    try {
      var range = document.createRange();
      range.setStart(opts.node, opts.start);
      range.setEnd(opts.node, opts.end);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { console.warn(e); };
  };

};



/**
 * Simple pub-sub mechanism, can create topical channels,
 * or make objects listenable to. Sample use:
 *
 * var AppActions = PubSub.topic(["appstart", "title"]);
 * var unsub = AppActions.title.listen(function(x) { console.log("First title:", x); unsub(); });
 * AppActions.title("ohoo");
 * 
 * var TypeStore = function(type) {
 *   var self = PubSub.listenify({type: type, data: []});
 *   self.update = function(data) { self.data = data; self.trigger(type, data); };
 *   return self;
 * };
 * 
 * var DeviceStore = new TypeStore("devices");
 * DeviceStore.listen(function(type, data) { console.log("Updated:", type, data); });
 * DeviceStore.update([{id: 1}]);
 * 
 */
var PubSub = new function() {
  var self = this;
  self._map = new Map(); // {key: Set(callback, )}

  /** Returns {key1: listenable, ..}, or a single listenable if one string argument. */
  self.topic = function(keys) {
    if (arguments.length < 2 && !Array.isArray(keys))
      return new Listenable();

    if (arguments.length > 1) keys = Array.apply(null, arguments);
    return keys.reduce(function(o, v) { o[v] = new Listenable(); return o; }, {});
  };


  /** Returns object with .listen and .trigger and .unlisten attached. */
  self.listenify = function(object) {
    var listenable = new Listenable();
    object.listen   = listenable.listen;
    object.trigger  = listenable.trigger;
    object.unlisten = listenable.unlisten;
    return object;
  };


  /** Starts listening to triggers on key, returns unsubscriber. */
  self.listen = function(key, callback) {
    if (!self._map.has(key)) self._map.set(key, new Set());
    self._map.get(key).add(callback);
    return self.unlisten.bind(null, key, callback);
  };


  /** Triggers all registered key listeners asynchronously. */
  self.trigger = function(key, arg/*, arg, .. */) {
    if (!self._map.has(key)) return;

    var args = Array.apply(null, arguments).slice(1);
    self._map.get(key).forEach(function(callback) {
      window.setTimeout(function() { callback.apply(null, args); });
    });
  };


  /** Unsubscribes callback from listening to key. */
  self.unlisten = function(key, callback) {
    if (self._map.has(key)) self._map.get(key).delete(callback);
  };


  /** Callable with .listen, .trigger and .unlisten, invoke calls .trigger. */
  var Listenable = self.Listenable = function() {
    var self = function(arg/*, arg, .. */) {
      return PubSub.trigger.apply(null, [self].concat(Array.apply(null, arguments)));
    };

    self.listen   = function(callback) { return PubSub.listen(self, callback); };
    self.trigger  = self;
    self.unlisten = function(callback) { return PubSub.unlisten(self, callback); };

    return self;
  };

};
