/**
 * Data handling and persistence logic.
 * Requires util.js.
 *
 * ------------------------------------------------------------------------------
 * This file is part of Deckathlon - card game website.
 * Released under the MIT License.
 *
 * @author    Erki Suurjaak
 * @created   10.05.2019
 * @modified  14.05.2020
 */

var DataActions = PubSub.topic(
  "save",        // Saves data and updates server         (type, data, onsuccess, onerror)
  "remove",      // Deletes data locally and from server  (type, data, onsuccess, onerror)
  "update"       // Updates type with specified data      (type, data)
);


/**
 * Data store for a specific data type. Data can be a list or a single object.
 * When store contents change, listeners are invoked with (type).
 *
 * Root methods return cloned values, safe for modification;
 * .rw methods (.rw.get() etc) return uncloned items, NOT SAFE for modification.
 *
 * opts: {
 *   key:        primary key field name,
 *   fields:     {name: {..}},
 *   autofilter: automatically applied filter on all results,
 *   order:      "field" or ["field1", ] or [["field1", ], [false, ]]
 *               true for ascending (default), false for descending,
 *   single:     single object store,
 *   transform:  function(item) return transformed item, called on update,
 * }
 */
var TypeStore = function(type, opts) {
  var self = this;
  self.type  = type;
  self.key   = undefined;
  self.opts  = {}; // {single, order, transform, autofilter, fields}
  self._map  = {};
  self._list = [];


  /** Returns item with specified key, or dict of items matching filter. */
  var _get = function(doClone, key_or_filter) {
    var result = undefined;
    var filter = arguments[1] instanceof Function || Util.isDict(arguments[1])
                 ? arguments[1] : undefined;

    if (filter) {
      var items = _generic_filter(_autofilter(self._list), filter);
      result = items.reduce(function(o, v) { o[v[self.key]] = v; return o; }, {});
    } else if (arguments.length > 1) {
      result = _autofilter(self._map[key_or_filter]);
    } else result = _autofilter(self._map, true);
    return doClone ? Util.deepclone(result) : result;
  };


  /** Returns first item matching filter. */
  var _next = function(doClone, filter) {
    for (var i = 0, count = self._list.length; i < count; i++) {
      var item = _autofilter(self._list[i]);
      if (item && _generic_filter([item], filter).length)
        return doClone ? Util.deepclone(item) : item;
    };
  };


  /** Returns store items matching filter. */
  var _filter = function(doClone, filter) {
    var result = _generic_filter(_autofilter(self._list), filter);
    return doClone ? Util.deepclone(result) : result;
  };


  /** Returns items sorted according to configured order, if any. */
  var _sort = function(items) {
    if (!self.opts.order) return items;

    if (self.opts.order instanceof Function) return self.opts.order(items);
    else return Util.sortObjects(items, self.opts.order[0], self.opts.order[1]);
  };


  /** Updates the store with item, returns changed object if anything changed. */
  var _updateItem = function(item) {
    var safestringify = function(x) { try { return JSON.stringify(x); } catch (e) {}; };

    Object.keys(self.opts.fields || {}).forEach(function(col) {
      if (self.opts.fields[col].drop) delete item[col];
    });

    if (self.opts.single) {
      var formerstr = safestringify(self._map),
          latter = Util.update(self._map, item);
    } else {
      var id = self.key && (self.key in item) ? item[self.key] : undefined;
      if (id === undefined && self.key) {
        console.warn("Warning: no ID when updating {0} with {1}".format(self.type, item));
        return;
      };

      var former = self._map[id];
      var formerstr = safestringify(former);
      var latter = self._map[id] = Util.update(former || {}, item);
    };

    return (!formerstr || formerstr !== safestringify(latter)) ? latter : null;
  };


  /** Returns list of items matching filter. */
  var _generic_filter = function(items, filter) {
    if (!filter) return items;
    else if (filter instanceof Function) return items.filter(filter);

    var result = [],
        fields = Object.keys(filter);
    for (var i = 0, count = items.length; i < count; i++) {
      var item = items[i], match = true;
      for (var j = 0, keycount = fields.length; j < keycount; j++) {
        var field = fields[j], flt = filter[field], val = item[field];

        if (flt instanceof Function)
          match &= flt(val, field, item);   // Filter function for field
        else if (Util.isDict(flt) && !Util.isDict(flt))
          match &= Boolean(flt[val]);       // Truthy key in object
        else if (Array.isArray(flt) && !Array.isArray(val))
          match &= (flt.indexOf(val) >= 0); // Inclusion in array
        else if (!Array.isArray(flt) && Array.isArray(val))
          match &= (val.indexOf(flt) >= 0); // Filter value in field array
        else if (Array.isArray(flt) && Array.isArray(val))
          match &= (Util.intersect(flt, val).length == val.length); // Array contents equality
        else match &= (val == flt);         // Simple 1:1 match

        if (!match) break; // for var j
      };
      if (match) result.push(item);
    };
    return result;
  };


  /** Returns data (list, map, or single object) where matching current autofilter. */
  var _autofilter = function(data, isMap) {
    if (!data || !self.opts.autofilter) return data;
    var result = undefined;

    if (isMap) {
      var items = _generic_filter(Util.objectValues(data), self.opts.autofilter);
      result = items.reduce(function(o, v) { o[v[self.key]] = v; return o; }, {});
    } else if (Array.isArray(data)) {
      result = _generic_filter(data, self.opts.autofilter);
    } else {
      result = _generic_filter([data], self.opts.autofilter)[0];
    };
    return result;
  };



  /* ------------------------ Public API ------------------------ */


  /** Returns item with specified key, or dict of items matching filter. */
  self.get = _get.bind(null, true);


  /** Returns a list of items. */
  self.list = _filter.bind(null, true, null);


  /** Returns the first item matching filter, if any. */
  self.next = _next.bind(null, true);


  /**
   * Returns a list of items matching value or callback filter.
   * Supports in-array matches: if scalar field value in filter array value,
   * or scalar filter value in array field value.
   *
   * @param   filter  {fieldname: matching value
   *                              or [value1, ..] or {value1: truthy, ..}
   *                              or function(value, fieldname, item) == truthy}
   *                  or function(item) == truthy
   */
  self.filter = _filter.bind(null, true);


  /** Returns uncloned items, DO NOT modify results. */
  self.rw = {
    get:    _get.bind(null, false),
    list:   _filter.bind(null, false, null),
    filter: _filter.bind(null, false),
    next:   _next.bind(null, false),
  };


  /** Returns list of item keys. */
  self.keys = function() {
    return self.opts.single ? Object.keys(self._map)
           : _autofilter(self._list).map(function(x) { return x[self.key]; });
  };


  /** Returns whether there is any item with specified key or matching filter. */
  self.has = function(key_or_filter) {
    var filter = (key_or_filter instanceof Function || Util.isDict(key_or_filter))
                 ? key_or_filter : undefined,
        key    = !filter && key_or_filter;

    if (filter) {
      for (var i = 0, count = self._list.length; i < count; i++) {
        var item = _autofilter(self._list[i]);
        if (_generic_filter([item], filter).length) return true;
      };
      return false;
    } else return (key in self._map) && Boolean(_autofilter(self._map[key]));
  };


  /**
   * Configures store settings.
   *
   * @param   opts  {key: primary key field name,
   *                 autofilter: automatically applied filter on all results,
   *                 order: "field" or ["field1", ] or [["field1", ], [false, ]]
   *                        true for ascending (default), false for descending,
   *                 single: single object store,
   *                 transform: function(item) return transformed item, called on update,
   *                }
   */
  self.configure = function(opts) {
    if (!opts) return;

    if (opts.key) self.key = opts.key;

    if (opts.autofilter) self.opts.autofilter = opts.autofilter;

    if ("single" in opts) self.opts.single = opts.single

    if (opts.transform && opts.transform instanceof Function) self.opts.transform = opts.transform;

    if (opts.order && opts.order instanceof Function) self.opts.order = opts.order;
    else if (opts.order) {
      var sortfields = Array.isArray(opts.order) ? opts.order : [opts.order],
          sortorders = Array.isArray(sortfields[1]) ? sortfields[1] : [];
      sortfields = Array.isArray(sortfields[0]) ? sortfields[0] : sortfields;
      while (sortfields.length > sortorders.length) sortorders.push(true);
      if (sortfields.length) self.opts.order = [sortfields, sortorders];
    };
  };


  /** Updates store with a list or a single item, triggers listeners on change. */
  self.update = function(data) {
    var items = Array.isArray(data) ? data : data ? [data] : [],
        updated = [];

    for (var i = 0; i < items.length; i++) {
      var item = Util.deepclone(items[i]);
      if (self.opts.transform) item = self.opts.transform(item);
      if (item = _updateItem(item)) updated.push(item);
    };
    if (!updated.length) return;

    if (!self.opts.single) self._list = _sort(Util.objectValues(self._map));
    self.trigger(self.type);
  };


  /** Removes specified item(s) from store, triggers listeners on change. */
  self.remove = function(data) {
    var items = Array.isArray(data) ? data : data ? [data] : [],
        changed = false;

    for (var i = 0, count = items.length; i < count; i++) {
      var id = self.key && Util.isDict(items[i]) ? items[i][self.key] : items[i];
      changed |= (id in self._map);
      delete self._map[id];
    };
    if (!changed) return;

    if (!self.opts.single) self._list = _sort(Util.objectValues(self._map));
    self.trigger(self.type);
  };


  /** Replaces store data with a list or a single item, triggers listeners on change. */
  self.replace = function(data) {
    var items = Array.isArray(data) ? data : data ? [data] : [],
        changed = Boolean((self.opts.single ? Object.keys(self._map) : self._list).length) || items.length;
    self._map = {}, self._list = [];

    for (var i = 0, count = items.length; i < count; i++) {
      var item = Util.deepclone(items[i]);
      if (self.opts.transform) item = self.opts.transform(item);
      _updateItem(item);
    };
    if (!changed) return;

    if (!self.opts.single) self._list = _sort(Util.objectValues(self._map));
    self.trigger(self.type);
  };


  /** Reapplies transform on all objects, triggers update listeners if changed. */
  self.retransform = function() {
    if (!self.opts.transform) return;

    var items = self.opts.single ? [self._map] : self._list,
        updated = [];

    for (var i = 0, count = items.length; i < count; i++) {
      item = self.opts.transform(Util.deepclone(items[i]));
      if (item = _updateItem(item)) updated.push(item);
    };
    if (!updated.length) return;

    if (!self.opts.single) self._list = _sort(Util.objectValues(self._map));
    self.trigger(self.type);
  };


  self.configure(opts);
  return PubSub.listenify(self);
};






/**
 * An aggregate data store, contains any number of TypeStores,
 * binds DataActions listenables, provides polling, data relation lookups.
 * Backend query results can be cached.
 *
 * opts: {
 *   rootURL:           root URL for API queries like "/api/v3",
 *   schema:   {
 *     typename: {
 *       key:           primary key name,
 *       fields:        {name: {
 *         edit:        true if editable field,
 *         default:     default value on blank(),
 *         type:        field type like "number",
 *         min:         field minimum value if number field,
 *         max:         field maximum value if number field,
 *         fk:          foreign table,
 *         fklabel:     foreign key format fields if not using foreign table default fklabel,
 *                      "col" or [col1, col2, ]
 *         fkformat:    foreign key format, "fmtstring with {0}{1} placeholders"
 *                      or func(v1, v2, )
 *         fkignore:    referential integrity not enforced on delete if true,
 *         null:        false if not nullable, blank() will autofill if fk and required,
 *         required:    requires value, blank() will autofill if required and !null,
 *         drop:        column dropped in store immediately,
 *       }},
 *       fklabel:       default foreign key format labels,
 *       fkformat:      default foreign key format,
 *       single:        single object store,
 *       static:        store updated only locally, no backend actions,
 *       urlstatic:     store item URL does not include item ID,
 *     },
 * },
 *   handlers: {
 *     onBeforeSave:    function(type, item),
 *     onBlank:         function(type, item),
 *     onQueryStart:    function(),
 *     onQueryComplete: function(),
 *     onUnauthorized:  function(callback to continue query),
 *   },
 * }
 */
var Data = new function() {
  var self = this;
  self.db      = {};    // {name: TypeStore, }
  self.schema  = {};    // {name: {key, fields: {name: {..}}}, ..}
  self.rootURL = null;  // root URL for API queries like "/api/v3"

  var _handlers   = {}; // {onSomething: callback(context-specific args)}
  var _queryCache = {}; // {url+method+json(data): {date: Date(), value: response string}}


  /**
   * Configures main data access and type stores.
   *
   * @param   opts  {rootURL, schema: {type: {key: fieldname, url: url if not same as type}, data: {type: ..}, handlers: {}} }
   */
  self.configure = function(opts) {
    if ("rootURL" in opts) self.rootURL = opts.rootURL;

    if (opts.handlers) Util.update(_handlers, opts.handlers);

    Object.keys(opts.schema || {}).forEach(function(type) {
      self.schema[type] = opts.schema[type] || self.schema[type] || {};

      Object.keys(self.schema[type].fields || {}).forEach(function(name) {
        Util.set(self.schema[type].fields[name], name, "name");
      }); // Ensure all fields have name-attribute in field opts

      self.db[type] = self.db[type] || new TypeStore(type, self.schema[type]);
    });

    Object.keys(opts.data || {}).forEach(function(type) {
      self.db[type] = self.db[type] || new TypeStore(type, self.schema[type]);
      self.db[type].update(opts.data[type]);
    });
  };


  /** Returns the item's primary key value according to configured type schema. */
  self.id = function(type, item) {
    return item && self.schema[type] ? item[self.schema[type].key] : undefined;
  };


  /**
   * Updates the data store and emits listener events.
   */
  self.update = function(type, data) {
    self.db[type] = self.db[type] || new TypeStore(type);
    self.db[type].update(data);
  };


  /**
   * Resets all current data of this type and reloads from backend.
   *
   * @param   type  data type
   */
  self.reload = function(type) {
    if (!self.db[type]) return console.warn("Unknown data type: ", type);

    var url = self.schema[type].url || type;
    self.query({url: url, method: "GET"}).success(function(data) {
      self.db[type].replace(data);
    });
  };


  /**
   * Returns a new empty item with default fields.
   *
   * @param   requireds  [{name, fk, required, !null}] or {name: {fk, required, !null}}
   *                     will populate foreign keys with first foreign item
   */
  self.blank = function(type, requireds) {
    var result = {};

    var populateField = function(name) {
      var field = self.schema[type].fields[name];
      if (field.virtual || name == self.schema[type].key) return;

      if ("default" in field) return result[name] = Util.clone(field.default);

      var value = "";
      if ("number" == field.type)    value = 0;
      else if ("date" == field.type) value = new Date();
      else if (field.fk)             value = null;
      result[name] = value;
    };

    Object.keys(self.schema[type].fields || {}).forEach(populateField);

    if (requireds) (Array.isArray(requireds) ? requireds : Object.keys(requireds)).forEach(function(x) {
      var name = Util.isString(x) ? x : x.name;
      var col = Util.isDict(x) ? x : requireds[name];
      if (col.fk && col.required && !col.null)
        result[name] = self.id(col.fk, self.db[col.fk].rw.next());
    });

    if (_handlers.onBlank) _handlers.onBlank(type, result);
    return result;
  };


  /**
   * Saves data, updates server and triggers DataActions.update.
   *
   * @param   type       data type
   * @param   data       a single item or list of items
   * @param   onSuccess  function invoked with updated items (inserted items will have IDs)
   * @param   onError    function invoked with error message, if any, and XMLHTTPRequest, if any
   */
  self.save = function(type, data, onSuccess, onError) {
    if (!data || Array.isArray(data) && !data.length)
      return onSuccess && window.setTimeout(onSuccess);

    self.db[type] = self.db[type] || new TypeStore(type);
    var items = Array.isArray(data) ? data.map(Util.deepclone) : [Util.deepclone(data)];

    if (!self.rootURL || self.schema[type].static) {
      self.db[type].update(items);
      return onSuccess && window.setTimeout(onSuccess, 0, items);
    };

    if (_handlers.onBeforeSave) items.forEach(_handlers.onBeforeSave.bind(null, type));

    var key = self.schema[type].key,
        itemsToUpdate = [],
        errors = [];
    var myOnSuccess = function(item, isNew, isLast, result) {
      if (result instanceof Object) item = Util.merge(item, result)
      else if (isNew && (Util.isNumeric(result) || Util.isString(result))) item[key] = result;
      itemsToUpdate.push(item);
      if (!isLast) return;

      if (_handlers.onQueryComplete) _handlers.onQueryComplete();
      self.db[type].update(itemsToUpdate);
      if (onSuccess) onSuccess(itemsToUpdate);
      if (onError && errors.length) onError(errors.filter(Boolean).join(" "));
    };
    var myOnError = function(isLast, error, req) {
      errors.push(error);
      if (!isLast) return;

      if (_handlers.onQueryComplete) _handlers.onQueryComplete();
      if (itemsToUpdate.length) {
        self.db[type].update(itemsToUpdate);
        if (onSuccess) onSuccess(itemsToUpdate);
      };
      if (onError && errors.length) onError(errors.filter(Boolean).join(" "), req);
    };

    if (_handlers.onQueryStart) _handlers.onQueryStart();
    for (var i = 0, count = items.length; i < count; i++) {
      var item = items[i],
          id = item[key],
          isNew = (id === undefined),
          isLast = (i == items.length - 1),
          method = isNew ? "POST" : "PUT",
          url = self.schema[type].url || type;
      if (!isNew && !self.schema[type].urlstatic) url += "/" + id;
      self.query({url: url, method: method, data: item}).success(myOnSuccess.bind(null, item, isNew, isLast)).error(myOnError.bind(null, isLast));
    };
  };


  /**
   * Deletes data, updates server and triggers DataActions.update.
   *
   * @param   type       data type
   * @param   data       a single item or list of items
   * @param   onSuccess  function called on success
   * @param   onError    function invoked with error message, if any
   */
  self.remove = function(type, data, onSuccess, onError) {
    if (!data || Array.isArray(data) && !data.length) 
      return onSuccess && window.setTimeout(onSuccess);

    var items = Array.isArray(data) ? data : [data];
    var unremovables = [];
    items = items.filter(function(item) {
      if (!self.hasRelations(type, item)) return true;
      else unremovables.push(item);
    });

    var key = self.schema[type].key;
    self.db[type] = self.db[type] || new TypeStore(type);

    if (!unremovables.length && (!self.rootURL || self.db[type].static)) {
      self.db[type].remove(items);
      return onSuccess && window.setTimeout(onSuccess);
    };

    if (!items.length && !unremovables.length) return onSuccess && window.setTimeout(onSuccess);

    if (unremovables.length) {
      return onError && window.setTimeout(onError, 0,
        _("Cannot delete {0} item #{1}: there are related rows.")
          .format(type, Util.lookup(unremovables, key).join(", #"))
      );
    };

    var errors   = [],
        removeds = [];
    var myOnSuccess = function(item, isLast) {
      removeds.push(item);
      if (!isLast) return;

      if (_handlers.onQueryComplete) _handlers.onQueryComplete();
      Data.db[type].remove(removeds);
      onSuccess && onSuccess();
      if (onError && errors.length) onError(errors.filter(Boolean).join(" "));
    };
    var myOnError = function(isLast, error) {
      errors.push(error);
      if (!isLast) return;

      if (_handlers.onQueryComplete) _handlers.onQueryComplete();
      if (onError && errors.length) onError(errors.filter(Boolean).join(" "));
    };

    if (_handlers.onQueryStart) _handlers.onQueryStart();
    for (var i = 0, count = items.length; i < count; i++) {
      var item = items[i],
          id = item[key],
          url = self.schema[type].url || type,
          method = "DELETE",
          isLast = (i == items.length - 1);
      if (id !== undefined && !self.schema[type].urlstatic) url += "/" + id;
      self.query({url: url, method: method}).success(myOnSuccess.bind(null, item, isLast)).error(myOnError.bind(null, isLast));
    };
  };



  /**
   * Begins polling the specified URL with specified interval, starting now.
   * Invoking poll for the same URL will reconfigure existing poll,
   * or cancel existing poll if interval is falsy or negative.
   *
   * @param   url         URL to poll
   * @param   interval    milliseconds between poll requests, or falsy/negative to stop
   * @param   data        arguments for poll request, if any,
   *                      or a function providing them, invoked with previous arguments
   */
  self.poll = function(url, interval, data) {
    self.poll._timers = self.poll._timers || {};
    if (url in self.poll._timers)
      self.poll._timers[url] = window.clearTimeout(self.poll._timers[url]);
    if (!interval || interval <= 0) return;

    var mypoll = function(args) {
      var dt_start = new Date();
      self.query({url: url, data: args}).success(function(result) {
        var deleteds = result.__deleted__; delete result.__deleted__;
        Object.keys(result).forEach(function(type) { DataActions.update(type, result[type]); });
        Object.keys(deleteds || {}).forEach(function(type) { self.db[type] && self.db[type].remove(deleteds[type]); });
        var nextinterval = Math.max(0, interval - (new Date() - dt_start));
        var nextargs = (data instanceof Function) ? data(args) : args;
        self.poll._timers[url] = window.setTimeout(mypoll, nextinterval, nextargs);
      }).error(function() {
        var nextinterval = Math.max(0, interval - (new Date() - dt_start));
        self.poll._timers[url] = window.setTimeout(mypoll, nextinterval, args);
      });
    };

    self.poll._timers[url] = window.setTimeout(function() {
      mypoll(data instanceof Function ? data() : data);
    });
  };


  /**
   * Makes an AJAX query to root/url, returns JSON-decoded data on success.
   * Can use callback chaining, as query({opts}).success(func).error(func).complete(func).
   *
   * @param   options  {url, data, method, success(data), error(error, req), complete(),
   *                    cache: seconds to cache or true if forever,
   *                    skipcache: true if query should skip existing cache but update it later}
   */
  self.query = function(opts) {
    var self = this;
    opts = Util.clone(opts);
    if (opts.url.indexOf(self.rootURL) !== 0)
      opts.url = (self.rootURL || "") + opts.url;

    var chainer = {
      success:  function(callback) { opts.success  = callback; return chainer; },
      error:    function(callback) { opts.error    = callback; return chainer; },
      complete: function(callback) { opts.complete = callback; return chainer; },
    };

    var isCached = false, cachekey = null;
    if (opts.cache && !opts.skipcache) {
      cachekey = [opts.url, opts.method || "POST",
                 (undefined === opts.data) ? "" : JSON.stringify(opts.data)];
      var lookup = _queryCache[cachekey];
      var isCached = lookup && (opts.cache === true || +lookup.date >= +new Date());
      if (isCached) window.setTimeout(function() {
        if (opts.success)  opts.success(Util.jsonLoad(lookup.value).data);
        if (opts.complete) opts.complete();
      });

      // Clear cache of stale data
      window.setTimeout(function() {
        Object.keys(_queryCache).forEach(function(key) {
          var lookup = _queryCache[key];
          if (+lookup.date < +new Date()) delete _queryCache[key];
        });
      });
    };
    if (isCached) return chainer;

    Util.ajax(opts).success(function(result) {
      if (!result || result.errcode) {
        var err = _("Error posting to {0}, result: {1}").format(opts.url, result);
        if (opts.error) opts.error(err, result);
        else console.error(err, result);
      } else {
        var data = Util.jsonLoad(result).data || {};
        if (opts.cache) {
          var dt = new Date(new Date() - 0 + (opts.cache === true ? 365*24*3600*1000 : opts.cache*1000));
          _queryCache[cachekey] = {date: dt, value: result};
        };
        if (opts.success) opts.success(data);
      };
    }).error(function(req) {
      if (401 == req.status && _handlers.onUnauthorized)
        return _handlers.onUnauthorized(self.query.bind(null, opts));

      var err = _("Error posting to {0}, result: {1} ({2})").format(opts.url, req.status, req.statusText);
      if (req.status && Util.isString(req.response)) {
        try {
          err = Util.get(Util.jsonLoad(req.response), "error") || err;
        } catch (e) { console.warn(e); };
      } else if (!req.status) err = _("Error contacting server.");
      if (opts.error) opts.error(err, req);
      else console.error(err, req);
    }).complete(function() {
      if (opts.complete) opts.complete();
    });

    return chainer;
  };


  /** Returns whether the specified item has related rows in another table. */
  self.hasRelations = function(type, item) {
    var id = self.id(type, item);
    if (id == null) return false;

    return Object.keys(self.schema).some(function(mytype) {
      return Object.keys(self.schema[mytype].fields || {}).some(function(fname) {
        var field = self.schema[mytype].fields[fname];
        if (field.fk == type && !field.fkignore)
          return self.db[mytype].has(Util.object(fname, id));
      });
    });
  };


  /**
   * Returns related row from related type store, by schema foreign keys.
   * Can navigate through intermediary tables,
   * e.g. getRelation("events", {fk_device: 3}, "devicetypes")
   *      will go events->devices->devicetypes.
   */
  self.getRelation = function(type, item, targettype) {

    // Try simple reverse lookup first: targettype with item as foreign key
    var target = null,
        myid = self.id(type, item);
    if (myid != null && Object.keys(self.schema[targettype].fields || {}).some(function(fname) {
      var col = self.schema[targettype].fields[fname];
      if (col.fk != type) return;
      target = self.db[targettype].next(Util.object(fname, myid));
      return Boolean(target);
    })) return target;


    /** Returns item from type store by scalar key or any from array of keys. */
    var getByPk = function(type, pks) {
      if (!Array.isArray(pks)) return self.db[type].get(pks);
      return self.db[type].next(Util.object(self.schema[type].key, pks));
    };


    var reachedtypes = {}; // {type: true} to avoid cycles
    var myget = function(mytype, myitem) {
      if (!myitem) return;

      // Collect all mytype foreign keys
      var foreigns = Object.keys(self.schema[mytype].fields || {}).reduce(function(o, name) {
        var col = self.schema[mytype].fields[name];
        if (col.fk && !reachedtypes[col.fk] && myitem[name] != null
        && (!Array.isArray(myitem[name]) || myitem[name].length))
          (o[col.fk] = o[col.fk] || []).push(name);
        return o;
      }, {}); // {foreign type: [foreign key name]}

      // Reached target type from current item, no need for going deeper
      if (foreigns[targettype])
        return foreigns[targettype].reduce(function(o, fname) {
          return o || getByPk(targettype, myitem[fname]);
        }, null);

      // Descend into further relations from intermediary foreign item
      return Object.keys(foreigns).reduce(function(o, ftype) {
        return o || foreigns[ftype].reduce(function(o2, fname) {
          if (o2) return o2;
          var col = self.schema[mytype].fields[fname];
          reachedtypes[col.fk] = true;
          return myget(col.fk, getByPk(col.fk, myitem[fname]));
        }, null);
      }, null);
    };

    return myget(type, item);
  };


  /** Empties the current query cache. */
  self.cacheClear = function() { _queryCache = {}; };

  Object.keys(DataActions).forEach(function(key) { DataActions[key].listen(self[key]); });
};
