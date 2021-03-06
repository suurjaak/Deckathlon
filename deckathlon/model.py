# -*- coding: utf-8 -*-
"""
Data facade.

------------------------------------------------------------------------------
This file is part of Deckathlon - card game website.
Released under the MIT License.

@author    Erki Suurjaak
@created   17.04.2020
@modified  23.05.2020
------------------------------------------------------------------------------
"""
import datetime
import hashlib
import httplib
import logging
import os

from . import conf
from . import gaming
from . lib import db, util

logger = logging.getLogger(__name__)



def finalize(func):
    """Decorator that closes database connection after function call."""
    def wrapper(*args, **kwargs):
        try: result = func(*args, **kwargs)
        except Exception:
            logger.exception("Error invoking %s.", func)
            result = None, "Unexpected error", httplib.INTERNAL_SERVER_ERROR
        finally:
            try: db.close(cascade=True)
            except Exception: logger.warn("Error closing database.", exc_info=True)
        return result
    return wrapper


@finalize
def login(username, password):
    """Returns user data row if username and password are valid."""
    result, error, status = None, None, httplib.OK

    passhash = hashlib.pbkdf2_hmac("sha256", password, conf.SecretKey, 10000)
    where = {"username": username, "password": passhash.encode("hex")}
    with db.transaction() as tx:
        result = tx.fetchone("users", where=where)

        if result: tx.update("online", {"dt_online": util.utcnow(), "active": True},
                             fk_user=result["id"], fk_table=None)
        else:
            error, status = "Invalid username or password", httplib.UNAUTHORIZED

    return adapt(result, result and result["id"], "users"), error, status



@finalize
def pagedata(request, page, lang, userid=None, **kwargs):
    """Returns data for page as {type: [{..}, ]}."""
    result, error, status = {}, None, httplib.OK
    update_offline()

    if "index" == page:
        result, error, status = gaming.Table(userid).index()

    if "table" == page:
        result, error, status = gaming.Table(userid).poll(shortid=kwargs["shortid"])

    if not error:
        root = request.app.get_url("/")
        result["settings"] = dict(rootURL=root, dataURL=root + "api/",
                                  staticURL=root + "static/", page=page,
                                  lang=lang, about=conf.About, title=conf.Title,
                                  author=conf.Author, version=conf.Version,
                                  versiondate=conf.VersionDate)

    if not error and userid:
        result["user"] = db.fetchone("users", id=userid)

    return adapt(result, userid), error, status


@finalize
def data_action(datatype, path, op, data, userid=None):
    """
    Carries out a GET (select), POST (create), PUT (update), or DELETE 
    operation on database data.

    @return  (payload, error, HTTP status)
    """
    result, error, status = None, None, httplib.OK
    update_offline()

    if "POST" == op:

        if "actions" == datatype:
            result, error, status = gaming.Table(userid).action(data)

        if "requests" == datatype:
            result, error, status = gaming.Table(userid).request(data)

        if "tables" == datatype:
            result, error, status = gaming.Table(userid).create(data)

        if "users" == datatype:
            username, password = (data[x].strip() for x in ("username", "password"))
            if not username or not password:
                error, status = "Required data missing", httplib.BAD_REQUEST
            else:
                with db.transaction() as tx:
                    if tx.fetchone("users", "1", username=username):
                        error, status = "Username exists", httplib.CONFLICT
                    else:
                        pw = hashlib.pbkdf2_hmac("sha256", password, conf.SecretKey, 10000)
                        userid = tx.insert("users", username=username, password=pw.encode("hex"))
                        tx.insert("online", fk_user=userid)
                        result = tx.fetchone("users", id=userid)
                        logger.info("Registered user '%s'.", username)

    if "PUT" == op:

        if "players" == datatype:
            result, error, status = gaming.Table(userid).update_player(int(path), data)

        if "requests" == datatype:
            result, error, status = gaming.Table(userid).request_response(int(path), data)

        if "tables" == datatype:
            result, error, status = gaming.Table(userid).update(int(path), data)

    if "DELETE" == op:

        if "players" == datatype:
            result, error, status = gaming.Table(userid).remove_player(int(path))

    return adapt(result, userid, datatype), error, status


@finalize
def poll(args, userid, tableid=None):
    """Returns data for poll request, as (data, error, status)."""
    result, error, status = {}, None, httplib.OK
    update_offline()

    dt_from = args.get("dt_from")
    if dt_from and "dt_now" in args:
        dt_from += util.utcnow() - args["dt_now"]

    if tableid is not None:
        result, error, status = gaming.Table(userid).poll(tableid, dt_from=dt_from)
    else:
        result, error, status = gaming.Table(userid).poll_index(dt_from)

    result = result and {k: v for k, v in result.items() if v}
    return adapt(result, userid), error, status


def update_offline():
    """Drops active-flag from all users with sufficient inactivity."""
    DELTA_OFFLINE = datetime.timedelta(seconds=conf.OfflineInterval)
    where = {"active": True, "dt_online": ("<", util.utcnow() - DELTA_OFFLINE)}
    with db.transaction() as tx:
        tx.update("online", {"active": False}, where=where)


def adapt(data, userid, datatype=None):
    """
    Processes data for UI. Retains only configured fields, drop fields 
    where drop=True, runs field adapters.
    """
    if not data: return data
    result = data

    if datatype: result = {datatype: data}
    for mytype, mydata in (result or {}).items():
        if util.get(conf.DbSchema, mytype, "fields") is None: continue # for mytype, mydata

        for mydict in util.listify(mydata):
            for k, col in conf.DbSchema[mytype]["fields"].items():
                if callable(col.get("adapt")):
                    mydict[k] = col["adapt"](mydict.get(k), mydict, userid)

        for mydict in util.listify(mydata):
            for k in list(mydict):
                col = util.get(conf.DbSchema, mytype, "fields", k)
                if col is None or col.get("drop"): mydict.pop(k)
    if datatype: result = result[datatype]
    else: result = {k: v for k, v in result.items() if v}

    return result
    

def init():
    """Initializes database connection."""
    db.init(conf.DbEngine, conf.DbOpts)
    if "sqlite" == conf.DbEngine:
        p = os.path.join(conf.RootPath, "etc", "db", "sqlite.sql")
        if os.path.isfile(p):
            with open(p) as f: db.executescript(f.read())
