# -*- coding: utf-8 -*-
"""
Utility functions and classes.

------------------------------------------------------------------------------
This file is part of Deckathlon - card game website.
Released under the MIT License.

@author      Erki Suurjaak
@created     04.02.2015
@modified    07.05.2020
------------------------------------------------------------------------------
"""
import ast
import base64
import collections
import ConfigParser as configparser
import datetime
import decimal
import imghdr
import io
import json
import locale
import logging, logging.handlers
import math
import os
import re
import sqlite3
import urllib
import urlparse
import warnings

import pytz

logger = logging.getLogger(__name__)



class MaxLevelFilter(logging.Filter):
    """Lets through all logging messages up to specified level."""
    def __init__(self, level): self.level = level
    def filter(self, record): return record.levelno <= self.level


class ModuleFilter(logging.Filter):
    """Filters logging from Python modules by exclusion or inclusion."""
    def __init__(self, exclude=None, include=None):
        self.exclude = exclude or []
        self.include = include or []

    def filter(self, record):
        return record.module not in self.exclude \
               and (record.module in self.include or not self.include)


def init_logger(level, stdlog=None, errlog=None, format=None, exclusions=None):
    """
    Initializes a system-wide logger with specified loglevel and filenames for
    standard and error logs.
    """
    if not format:
        format = "%(asctime)s\t%(levelname)s\t%(module)s:%(lineno)s\t%(message)s"
    logger = logging.getLogger()
    logger.setLevel(level)

    kws = dict(maxBytes=2**31, backupCount=2**10, encoding="utf-8", delay=True)

    if stdlog:
        try: os.makedirs(os.path.dirname(stdlog))
        except EnvironmentError: pass
        defhandler = logging.handlers.RotatingFileHandler(stdlog, **kws)
        defhandler.setFormatter(logging.Formatter(format))
        defhandler.setLevel(logging.DEBUG)
        if errlog: defhandler.addFilter(MaxLevelFilter(logging.INFO))
        if exclusions: defhandler.addFilter(ModuleFilter(exclusions))
        logger.addHandler(defhandler)
    if errlog:
        try: os.makedirs(os.path.dirname(errlog))
        except EnvironmentError: pass
        errhandler = logging.handlers.RotatingFileHandler(errlog, **kws)
        errhandler.setFormatter(logging.Formatter("\n" + format))
        errhandler.setLevel(logging.WARN)
        logger.addHandler(errhandler)
    if not stdlog and not errlog:
        logger.addHandler(logging.NullHandler())


def json_dumps(data, indent=2, sort_keys=True):
    """
    Serializes to JSON, with datetime types converted to ISO 8601 format,
    and buffers converted to 'data:MEDIATYPE/SUBTYPE,base64,B64DATA'.
    """
    def dateencoder(x):
        if not isinstance(x, (datetime.datetime, datetime.date, datetime.time)): return
        if hasattr(x, "tzinfo") and x.tzinfo is None: x = pytz.utc.localize(x)
        return x.isoformat()
    binencoder = lambda x: isinstance(x, buffer) and encode_b64_mime(x)
    decencoder = lambda x: isinstance(x, decimal.Decimal) and \
                           (float(x) if x.as_tuple().exponent else int(x))
    encoder = lambda x: dateencoder(x) or binencoder(x) or decencoder(x)
    return json.dumps(data, default=encoder, indent=indent, sort_keys=sort_keys)


def json_loads(data):
    """
    Deserializes from JSON, with datetime strings converted to datetime objects,
    and strings with Base64 MIME header converted to decoded buffers.
    """
    decoder = lambda x: convert_recursive(x, {basestring: [parse_datetime, decode_b64_mime]})
    return json.loads(data, object_hook=decoder) if data else ""


def encode_b64_mime(buf):
    """Returns the buffer/string data like 'data:image/png,base64,iVBOR..'."""
    subtype = imghdr.what(file=None, h=buf)
    media = "image" if subtype else "application"
    subtype = subtype or "octet-stream"
    result = "data:%s/%s;base64,%s" % (media, subtype, base64.b64encode(buf))
    return result


def decode_b64_mime(string):
    """
    Returns a buffer containing Base64-decoded data, if string starts like
    'data:image/png,base64,iVBOR..'.
    """
    result = string
    match = re.match(r"^data:([\w\-=.,;/]+);base64,(.+)", string)
    if match:
        try:
            result = buffer(base64.b64decode(match.group(2)))
        except StandardError:
            logger.exception("Error decoding '%s'.", match.group(1))
    return result


def convert_recursive(d, converters):
    """
    Recursively converts values in the collection with given functions.
    Converters should return original value if not applicable.

    @param   d           list or tuple or dictionary
    @param   converters  {class: [function, ], }
    """
    if isinstance(d, (list, tuple)):
        pairs = enumerate(d)
    elif isinstance(d, dict):
        pairs = d.items()
    result = []
    for k, v in pairs:
        no_converter = True
        for classtype, funcs in converters.items():
            if isinstance(v, classtype):
                no_converter = False
                with warnings.catch_warnings(): # UnicodeWarning on x != v
                    warnings.simplefilter("ignore")
                    v = next((x for x in (f(v) for f in funcs) if x != v), v)
        if no_converter and isinstance(v, (dict, list, tuple)):
            v = convert_recursive(v, converters)
        result.append((k, v))
    if isinstance(d, (list, tuple)):
        return type(d)(x[1] for x in result)
    elif isinstance(d, dict):
        return dict(result)


def parse_datetime(s):
    """
    Tries to parse string as ISO8601 datetime, returns input on error.
    Supports "YYYY-MM-DD[ T]HH:MM:SS(.micros)?(Z|[+-]HH:MM)?".
    All returned datetimes are timezone-aware, falling back to UTC.
    """
    if len(s) < 18: return s
    rgx = r"^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?(([+-]\d{2}:?\d{2})|Z)?$"
    result, match = s, re.match(rgx, s)
    if match:
        millis, _, offset = match.groups()
        minimal = re.sub(r"\D", "", s[:match.span(2)[0]] if offset else s)
        fmt = "%Y%m%d%H%M%S" + ("%f" if millis else "")
        try:
            result = datetime.datetime.strptime(minimal, fmt)
            if offset: # Support timezones like 'Z' or '+03:00'
                hh, mm = map(int, [offset[1:3], offset[4:]])
                delta = datetime.timedelta(hours=hh, minutes=mm)
                if offset.startswith("-"): delta = -delta
                z = pytz.tzinfo.StaticTzInfo()
                z._utcoffset, z._tzname, z.zone = delta, offset, offset
                result = z.localize(result)
        except ValueError: pass
    if isinstance(result, datetime.datetime) and result.tzinfo is None:
        result = pytz.utc.localize(result) # Force UTC timezone on unaware values
    return result


def utcnow():
    """Returns current datetime with UTC zone info."""
    return pytz.utc.localize(datetime.datetime.utcnow())


def latlng_center(latlngs):
    """Returns a geographical centerpoint as [latitude, longitude]."""
    if not latlngs: return []

    x = y = z = 0
    for latlng in latlngs:
        lat, lng = map(math.radians, latlng)
        x += math.cos(lat) * math.cos(lng)
        y += math.cos(lat) * math.sin(lng)
        z += math.sin(lat)
    x = x / len(latlngs)
    y = y / len(latlngs)
    z = z / len(latlngs)

    rads = (math.atan2(*yx) for yx in [(z, math.sqrt(x**2 + y**2)), (y, x)])
    return list(map(math.degrees, rads))


def safe_filename(filename):
    """Returns the filename with characters like \:*?"<>| removed."""
    return re.sub(r"[\/\\\:\*\?\"\<\>\|]", "", filename)


def to_unicode(value, encoding=None):
    """
    Returns the value as a Unicode string. Tries decoding as UTF-8 if 
    locale encoading fails.
    """
    result = value
    if not isinstance(value, unicode):
        encoding = encoding or locale.getpreferredencoding()
        if isinstance(value, str):
            try:
                result = unicode(value, encoding)
            except StandardError:
                result = unicode(value, "utf-8", errors="replace")
        else:
            result = unicode(str(value), errors="replace")
    return result


def get(collection, *path, **kwargs):
    """
    Returns the value at specified collection path. If path not available,
    returns the first keyword argument if any given, or None.
    Collection can be a nested structure of dicts, lists, tuples or strings.
    E.g. util.get({"root": {"first": [{"k": "v"}]}}, "root", "first", 0, "k").
    """
    default = (list(kwargs.values()) + [None])[0]
    result = collection if path else default
    for p in path:
        if isinstance(result, collections.Sequence):  # Iterable with index
            if result and isinstance(p, (int, long)) \
            and (p < len(result) or p < 0 and abs(p) - 1 < len(result)):
                result = result[p]
            else:
                result = default
        elif isinstance(result, collections.Mapping):  # Container with lookup
            result = result.get(p)
        else:
            result = default
        if result == default: break  # for p
    return result


def unwrap(iterable, key=None):
    '''
    Returns a list of key values, one from each item. If key is not given,
    takes first key from first item. Missing values are returned as None.
    '''
    result = []
    for item in iterable:
        if key is None: key = next(item.iterkeys(), None)
        result.append(item.get(key))
    return result


def parse_qs(qs):
    """
    Parses an URL query string into a dict, with datetime strings converted to
    datetime objects, strings with Base64 MIME header converted to 
    decoded buffers, and general strings decoded from UTF-8.
    """
    decoders = [parse_datetime, decode_b64_mime, lambda x: x.decode("utf-8")]
    return convert_recursive(urlparse.parse_qs(qs, keep_blank_values=True), {basestring: decoders})


def urlencode(data):
    """
    Converts a mapping or a sequence of two-element tuples to a percent-encoded
    query string, with datetime objects converted to ISO8601, buffer objects
    converted to Base64 with MIME header, and strings encoded as UTF-8.
    """
    dateencoder = lambda x: hasattr(x, "isoformat") and x.isoformat() or x
    binencoder = lambda x: isinstance(x, buffer) and encode_b64_mime(x) or x
    utfencoder = lambda x: isinstance(x, unicode) and x.encode("utf-8") or x
    encoders = [dateencoder, binencoder, utfencoder]
    return urllib.urlencode(convert_recursive(data, {basestring: encoders}), doseq=True)


def round_float(value, precision=1):
    """
    Returns the float as a string, rounded to the specified precision and
    with trailing zeroes (and . if no decimals) removed.
    """
    return str(round(value, precision)).rstrip("0").rstrip(".")


def sqlite_jsonify():
    """Adds JSON autoconvert support to SQLite table columns of type "JSON"."""
    [sqlite3.register_adapter(x, json_dumps) for x in (dict, list, tuple)]
    sqlite3.register_converter("JSON", json_loads)
    sqlite3.register_converter("timestamp", parse_datetime)


def recursive_decode(d, decoders):
    """Recursively converts strings in the collection with given decoders."""
    if isinstance(d, list):
        pairs = enumerate(d)
    elif isinstance(d, dict):
        pairs = d.items()
    result = []
    for k, v in pairs:
        if isinstance(v, basestring):
            v = next((x for x in (x(v) for x in decoders) if x != v), v)
        elif isinstance(v, (dict, list)):
            v = recursive_decode(v, decoders)
        result.append((k, v))
    if isinstance(d, list):
        return [x[1] for x in result]
    elif isinstance(d, dict):
        return dict(result)


def listify(data):
    '''Wraps data in a list if not an iterable collection.'''
    return data if isinstance(data, (list, set, tuple)) \
           else [] if data is None else [data]


def ini_load(filename, obj=None):
    """
    Returns object with attributes loaded from INI file. Can be used to
    populate a configuration module: ini_load("conf.ini", module).
    If object is a dictionary, sets values instead of attributes.
    A plain attribute object is created if none given. Will not fail on error.

    Configuration values are expected to be a valid JSON value, or a valid
    Python literal (strings, numbers, tuples, lists, dicts, booleans, None),
    anything else is interpreted as a string.

    If INI file has sections, directives under section are loaded into
    a hierarchical structure, for example reading in
    {"Title": "Foo", "Logging": {"StdLog": None, "ErrLog": {"Level": "WARN"}}}
    from the contents:

        Title = "Foo"
        [Logging]
        StdLog = null
        ErrLog.Level = "WARN"

    or equivalently from:

        Title = "Foo"
        [Logging]
        StdLog = null
        [Logging.ErrLog]
        Level = "WARN"

    or equivalently from:

        Title = "Foo"
        [Logging]
        StdLog = null
        ErrLog = {"Level": "WARN"}

    or equivalently from:

        Title = "Foo"
        Logging = {"StdLog": null, "ErrLog": {"Level": "WARN"}}

    NB! Root directives should precede other sections, 
    or be under a later [*] section, as sections lack explicit ends.

    NB! Section [DEFAULT] (case-sensitive) is special, directives under this
    will be mirrored into all sections (including root) if not already present.
    """
    ctor = dict if isinstance(obj, (dict, type(os))) else type("vars", (), {})
    obj = ctor() if obj is None else obj
    if not os.path.isfile(filename):
        logging.warn("Not a valid file: %s.", filename)
        return obj

    getter = lambda o, k: o.get(k) if isinstance(o, dict) else getattr(o, k, None)
    setter = lambda o, k, v: o.update({k: v}) if isinstance(o, dict) else setattr(o, k, v)

    def set_value(o, v, *path):
        ptr = o
        for k in path[:-1]: # Walk path to last parent key, create missing nodes
            ptr, lastptr = getter(ptr, k), ptr
            if isinstance(ptr, dict) or hasattr(ptr, "__dict__"): continue # for k
            ptr = ctor() if isinstance(lastptr, ctor) else {}
            setter(lastptr, k, ptr)
        setter(ptr, path[-1], v)

    def parse_value(raw):
        if raw is None: return raw
        try: return json.loads(raw) # Try to interpret as JSON
        except ValueError:
            try: return ast.literal_eval(raw) # Not JSON, fall back to eval
            except (ValueError, SyntaxError): return raw # Fall back to string

    # allow_no_value=True: "x\n" interpreted as x = None
    parser = configparser.RawConfigParser(allow_no_value=True)
    parser.optionxform = str # Force case-sensitivity on names
    try:
        with open(filename) as f:
            # Add a dummy [*], configparser expects everything under sections
            parser.readfp(io.BytesIO("[*]\n" + f.read()), filename)
        nestedrgx = re.compile(r"^[_a-z](\w+\.)+\w+$", re.I) # Name.As.Path
        for section in parser.sections() + ["DEFAULT"]:
            sectionpath = [section]
            if nestedrgx.match(section): sectionpath = re.split(r"\.+", section)
            for k, v in parser.items(section):
                path = [k] if section in ("*", "DEFAULT") else sectionpath + [k]
                if nestedrgx.match(k): path[-1:] = re.split(r"\.+", k)
                set_value(obj, parse_value(v), *path)
    except StandardError:
        logging.warn("Error reading config from %s.", filename, exc_info=True)
    return obj
