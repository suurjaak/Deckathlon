# -*- coding: utf-8 -*-
"""
Data model wrapper.

@author    Erki Suurjaak
@created   17.04.2020
@modified  02.05.2020
------------------------------------------------------------------------------
"""
import datetime
import hashlib
import httplib
import logging

from . import conf
from . import gaming
from . lib import db, util

logger = logging.getLogger(__name__)

DB_SCHEMA = {} # {type: {opts}}


def login(username, password):
    """Returns user data row if username and password are valid."""
    passhash = hashlib.pbkdf2_hmac("sha256", password, conf.SecretKey, 10000)
    where = {"username": username, "password": passhash.encode("hex")}
    data = db.fetch("users", where=where)
    return adapt(data, data and data["id"], "users")



def pagedata(request, page, userid=None, **kwargs):
    """Returns data for page as {type: [{..}, ]}."""
    data, error, status = {}, None, httplib.OK

    if "index" == page:
        data, error, status = gaming.Table(userid).index()

    if "table" == page:
        table = db.fetch("tables", "id", shortid=kwargs["shortid"])
        if table:
            data, error, status = gaming.Table(userid).poll(table["id"])
        else:
            error, status = "Not found", httplib.NOT_FOUND

    if not error:
        root = request.app.get_url("/")
        data["settings"] = dict(rootURL=root, dataURL=root + "api/",
                                staticURL=root + "static/",
                                version=conf.Version,
                                versiondate=conf.VersionDate)

    #if userid: # @todo figure it out
    #    db.update("users", {"dt_online": util.utcnow()}, id=userid)
    if not error and userid:
        data["user"] = db.fetch("users", id=userid)

    return adapt(data, userid), error, status


def data_action(datatype, path, op, data, userid=None):
    """
    Carries out a GET (select), POST (create), PUT (update), or DELETE 
    operation on database data.

    @return  (payload, error, HTTP status)
    """
    result, error, status = None, None, httplib.OK

    if "POST" == op:

        if "actions" == datatype:
            result, error, status = gaming.Table(userid).action(data)

        if "tables" == datatype:
            result, error, status = gaming.Table(userid).create(data)

        if "players" == datatype:
            result, error, status = gaming.Table(userid).join(data["fk_table"])

        if "users" == datatype:
            username, password = (data[x].strip() for x in ("username", "password"))
            if not username or not password:
                error, status = "Required data missing", httplib.BAD_REQUEST
            if db.fetch("users", "1", username=username):
                error, status = "Username exists", httplib.CONFLICT
            else:
                pw = hashlib.pbkdf2_hmac("sha256", password, conf.SecretKey, 10000)
                userid = db.insert("users", username=username, password=pw.encode("hex"))
                result = db.fetch("users", id=userid)

    if "PUT" == op:

        if "tables" == datatype:
            result, error, status = gaming.Table(userid).update(int(path), data)

    if "DELETE" == op:

        if "players" == datatype:
            table = db.fetch("tables", id=("EXPR", ("id IN (SELECT fk_table FROM players "
                                           "WHERE id = ?)", [path])))
            if table:
                result, error, status = gaming.Table(userid).leave(table["id"], int(path))
            else:
                error, status = "Table not found", httplib.NOT_FOUND

    #if userid: # @todo figure it out
    #    db.update("users", {"dt_online": util.utcnow()}, id=userid)

    return adapt(result, userid, datatype), error, status


def poll(args, userid, tableid=None):
    """
    Returns data for poll request, as (data, error, status).
    """
    result, error, status = {}, None, httplib.OK

    dt_from = args.get("dt_from")
    if dt_from and "dt_now" in args:
        dt_from += util.utcnow() - args["dt_now"]

    if tableid is not None:
        result, error, status = gaming.Table(userid).poll(tableid, dt_from)
    else:
        result, error, status = gaming.Table(userid).poll_index(dt_from)

    return adapt({k: v for k, v in result.items() if v}, userid), error, status


def adapt(data, userid, datatype=None):
    """
    Processes data for UI. Retains only configured fields, drop fields 
    where drop=True, runs field adapters.
    """
    if not data: return data
    result = data

    if datatype: result = {datatype: data}
    for mytype, mydata in (result or {}).items():
        if util.get(DB_SCHEMA, mytype, "fields") is None: continue # for mytype, mydata

        for mydict in util.listify(mydata):
            for k, col in DB_SCHEMA[mytype]["fields"].items():
                if callable(col.get("adapt")):
                    mydict[k] = col["adapt"](mydict.get(k), mydict, userid)

        for mydict in util.listify(mydata):
            for k in list(mydict):
                col = util.get(DB_SCHEMA, mytype, "fields", k)
                if col is None or col.get("drop"): mydict.pop(k)
    if datatype: result = result[datatype]

    return result
    

def init(dbschema, dbpath, dbstatements):
    """
    Initializes or reconfigures data and task model.
    """
    global DB_SCHEMA
    DB_SCHEMA = dbschema
    if dbpath:
        util.sqlite_jsonify()
        db.init(dbpath, dbstatements)
