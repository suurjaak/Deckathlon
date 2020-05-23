# -*- coding: utf-8 -*-
"""
Web frontend entrypoint. Can run as stand-alone server or under Apache et al.

------------------------------------------------------------------------------
This file is part of Deckathlon - card game website.
Released under the MIT License.

@author      Erki Suurjaak
@created     18.04.2020
@modified    22.05.2020
"""
import datetime
import httplib
import inspect
import logging
import os
import sys

import beaker.middleware
import bottle
from bottle import hook, request, response, route

from . import conf
from . import model
from . lib import translate, util


app = None   # Bottle application instance
logger = logging.getLogger(__name__)


def login_required(func):
    """Decorator that requires login or redirects to login."""
    def wrapper(*args, **kwargs):
        if request.session.get("userid"):
            return func(*args, **kwargs)
        return bottle.redirect(request.app.get_url("/"))
    return wrapper


def content_type(mime):
    """
    Decorator that returns endpoint content as specified MIME type,
    serializing result to JSON if MIME type is "application/json".
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            response.content_type = mime

            if "application/json" == mime \
            and isinstance(result, (type(None), int, long, basestring, dict, list, tuple)):
                result = util.json_dumps(result, indent=None)
            return result
        return wrapper
    return decorator


@hook("before_request")
def before_request():
    """Set up convenience variables, remove trailing slashes from route."""
    if not request: return
    request.environ["PATH_INFO"] = request.environ["PATH_INFO"].rstrip("/")
    request.session = request.environ["beaker.session"]


@route("/static/<filepath:path>")
def server_static(filepath):
    """Handler for serving static files."""
    mimetype = "image/svg+xml" if filepath.endswith(".svg") else "auto"
    resp = bottle.static_file(filepath, root=conf.StaticPath, mimetype=mimetype)
    resp.set_header("Cache-Control", "no-cache")
    return resp


@route("/logout", method=["GET", "POST"])
def logout():
    """Handler for logging out, redirects to root URL."""
    logger.info("Logging out %s.", request.session.get("username"))
    lang = request.session.get("lang")
    request.session.clear()
    if lang: request.session.update(lang=lang)
    return bottle.redirect(request.app.get_url("/"))


@route("/api/login", method=["POST"])
@content_type("application/json")
def login():
    """
    Handler for logging in via REST API.

    @param   username  login username
    @param   password  login password
    @return            {status: "ok"} or HTTP 401
    """
    result, error, status = {}, "", httplib.OK
    username, pw, user  = "", "", None
    try:
        body = request.body.read() or request.query_string
        data = util.json_loads(body) or {}
        username, pw = (data[x].strip() for x in ["username", "password"])
    except StandardError:
        error, status = "Login unsuccessful, unrecognized data.", httplib.BAD_REQUEST
        logger.exception(error)
    else:
        user, error, status = model.login(username, pw)

    logger.info("Logging in %s %ssuccessful.", username, "" if user else "un")
    if user:
        request.session.update(username=username, userid=user["id"],
                               login=datetime.datetime.utcnow())
    elif error: result = {"status": "error", "error": error}
    response.status = status
    return result


@route("/api/poll",                  method=["GET", "POST"])
@route("/api/poll/tables/<tableid>", method=["GET", "POST"])
@login_required
@content_type("application/json")
def api_poll(tableid=None):
    """
    Returns items changed after specified timestamp.

    @param   dt_from  UTC datetime from which to return changes
    @return           {?data: {type: []}<, status: "error", error: "message">}
    """
    result, error, status = {}, "", httplib.OK
    body = None
    try:
        body = request.body.read() or request.query_string
        if "POST" == request.method: args = util.json_loads(body or "{}")
        else: args = util.parse_qs(request.query_string)
    except Exception:
        error = "Error handling poll%s." % ("" if body is None else " for %s" % body)
        status = httplib.BAD_REQUEST
        logger.exception(error)
    else:
        payload, error, status = model.poll(args, request.session["userid"], tableid)

    if error: result.update(status="error", error=error)
    elif payload: result["data"] = payload
    response.status = status
    return result



@route("/api/users", method=["POST"])
@content_type("application/json")
def register():
    """
    Handler for registering via REST API.

    @param   username  login username
    @param   password  login password
    @return            {status: "ok"} or HTTP 400, 409
    """
    result, error, status = {}, "", httplib.OK
    try: data = util.json_loads(request.body.read())
    except Exception:
        error, status = "Registration unsuccessful.", httplib.BAD_REQUEST
        logger.exception(error)
    else:
        user, error, status = model.data_action("users", None, request.method, data)

    if error: result = {"status": "error", "error": error}
    else: request.session.update(username=user["username"], userid=user["id"],
                                 login=datetime.datetime.utcnow())
    response.status = status
    return result


@route("/api/<datatype>", method=["GET", "POST", "PUT", "DELETE"])
@route("/api/<datatype>/<path:path>", method=["GET", "POST", "PUT", "DELETE"])
@login_required
@content_type("application/json")
def api_action(datatype, path=""):
    """
    Handler for data actions on REST API.

    @return  {status: "ok" or "error", data: [] or {} or None, error: "message">}
    """
    result, error, status = {}, "", httplib.OK
    userid, username = map(request.session.get, ("userid", "username"))
    try:
        if "GET" == request.method: data = util.parse_qs(request.query_string)
        else: data = util.json_loads(request.body.read() or request.query_string or "null")
    except Exception:
        error = "Error handling query for %s." % "/".join(filter(bool, (datatype, path)))
        status = httplib.BAD_REQUEST
        logger.exception(error)
    else:
        payload, error, status = model.data_action(datatype, path, request.method, data, userid)

    if error: result.update(status="error", error=error)
    elif payload: result.update(data=payload)
    response.status = status
    return result


@route("/api")
def api_endpoints():
    """Handler for listing API endpoints."""
    result = {"__version__": "%s (%s)" % (conf.Version, conf.VersionDate)} # {href: {description, method}}
    doc = lambda r: inspect.getdoc(r.get_undecorated_callback()).split("\n")[0]
    for r in app.app.routes:
        result[r.rule] = result.get(r.rule) or dict(description=doc(r), method=[])
        result[r.rule]["method"].append(r.method)
    response.headers["Content-Type"] = request.headers.get("Content-Type", "text/plain")
    return util.json_dumps(result)


@route("/table/<shortid>", method="GET")
@login_required
def table(shortid):
    """Handler for showing a table page."""
    lang = request.session.get("lang", conf.DefaultLanguage)
    if lang not in conf.Languages: lang = conf.DefaultLanguage
    langs = conf.Languages
    translations = translate.get_all(lang)
    schema = conf.DbSchema

    userid = request.session.get("userid")
    data, error, status = model.pagedata(request, "table", lang, userid, shortid=shortid)
    if httplib.NOT_FOUND == status:
        return bottle.redirect(request.app.get_url("/"))
    elif error:
        raise bottle.HTTPError(status, error)

    poll = {"url": "poll/tables/%s" % data["tables"][0]["id"],
            "interval": conf.PollInterval}
    return bottle.template("table.tpl", locals())


@route("/<lang>/table/<shortid>", method="GET")
@login_required
def table_lang(lang, shortid):
    """Handler that sets session language and redirects to table page."""
    if lang not in conf.Languages: lang = conf.DefaultLanguage
    request.session.update(lang=lang)
    return bottle.redirect(request.app.get_url("/table/<shortid>", shortid=shortid))


@route("/")
def index():
    """Handler for showing the index or login page."""
    lang = request.session.get("lang", conf.DefaultLanguage)
    if lang not in conf.Languages: lang = conf.DefaultLanguage
    langs = conf.Languages
    request.session.update(lang=lang)
    translations = translate.get_all(lang)
    schema = conf.DbSchema
    root = request.app.get_url("/")

    userid = request.session.get("userid")
    if not userid:
        data, error, status = model.pagedata(request, "login", lang)
        return bottle.template("login.tpl", locals(), schema=conf.DbSchema)

    data, error, status = model.pagedata(request, "index", lang, userid)
    poll = {"url": "poll", "interval": conf.PollInterval}
    return bottle.template("index.tpl", locals())


@route("/<lang>")
def index_lang(lang):
    """Handler that sets session language and redirects to root."""
    if lang not in conf.Languages: lang = conf.DefaultLanguage
    request.session.update(lang=lang)
    return bottle.redirect(request.app.get_url("/"))


def unsupported(url):
    """Handler for redirecting unsupported endpoints to index."""
    logger.debug("Accessing unsupported url %r, redirecting to index.", url)
    return bottle.redirect(request.app.get_url("/"))


def init():
    """Initialize configuration and web application."""
    global app
    if app: return app

    bottle.TEMPLATE_PATH.insert(0, conf.TemplatePath)

    defconfigfile = os.path.join(conf.RootPath, "etc", "%s.ini" % conf.Name)
    configfile = os.getenv("%sCONF" % conf.Name.upper(), defconfigfile)
    util.ini_load(configfile, conf)
    util.init_logger(conf.LogLevel, conf.LogPath, conf.ErrorLogPath,
                     conf.LogFormat, conf.LogExclusions)
    translate.init(conf.DefaultLanguage, conf.TranslationTemplate, conf.AutoReload)
    model.init()
    logger.info("Initializing app, using configuration file %s.", configfile)

    bottle.route("/<url:path>", unsupported)

    sys.path.append(conf.RootPath)
    myapp = bottle.default_app()
    myapp.get_url = (lambda f: (lambda r, **k: conf.ServerPrefix + f(r, **k)))(myapp.get_url)
    bottle.BaseTemplate.defaults.update(get_url=myapp.get_url, _=translate.translate)

    app = beaker.middleware.SessionMiddleware(myapp, {
        "session.auto": True, # Data saved automatically, without save()
        "session.data_dir": conf.SessionPath,
        "session.cookie_expires": False, # Expires on closing browser
        "session.type": "file",
    })
    return app


def run():
    logger.info("Starting web server on port %s.", conf.ServerPort)
    bottle.run(app, server=conf.ServerBackend,
               host=conf.ServerIP, port=conf.ServerPort,
               debug=conf.AutoReload, reloader=conf.AutoReload,
               quiet=conf.Quiet, **conf.ServerBackendOptions)


app = init()

if "__main__" == __name__:
    run()
