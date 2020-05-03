# -*- coding: utf-8 -*-
"""
Web frontend entrypoint. Can run as stand-alone server or under Apache et al.

@author      Erki Suurjaak
@created     18.04.2020
@modified    03.05.2020
"""
import cgi
import datetime
import httplib
import inspect
import logging
import os
import sys
import urllib2
import beaker.middleware
import bottle
from bottle import hook, request, response, route

from . import conf
from . import model
from . lib import translate, util


app = None   # Bottle application instance
logger = logging.getLogger(__name__)


def login_required(func):
    """Decorator that requires login or returns HTTP 401."""
    def wrapper(*args, **kwargs):
        if request.session.get("userid"):
            return func(*args, **kwargs)
        request.session.delete()
        return bottle.abort(httplib.UNAUTHORIZED, "Access denied.")
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
    request.session.delete()
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
    body = request.body.read() or request.query_string
    username, pw, user, err = "", "", None, ""
    try:
        data = util.json_loads(body) or {}
        username, pw = (data[x].strip() for x in ["username", "password"])
        user = model.login(username, pw)
    except StandardError:
        err = "Login unsuccessful, unrecognized data."
        logger.exception(err)

    logger.info("Logging in %s %ssuccessful over REST.", username, "" if user else "un")
    if user:
        request.session.update(username=username, userid=user["id"],
                               login=datetime.datetime.utcnow())
        return {"status": "ok"}
    elif err:
        response.status = httplib.INTERNAL_SERVER_ERROR
        return {"status": "error", "error": err}
    elif not err:
        response.status = httplib.UNAUTHORIZED
        return {"status": "error", "error": "Invalid username or password"}


@route("/api/poll",           method=["GET", "POST"])
@route("/api/poll/<tableid>", method=["GET", "POST"])
@login_required
@content_type("application/json")
def api_poll(tableid=None):
    """
    Returns items changed after specified timestamp.

    @param   dt_from  UTC datetime from which to return changes
    @return           {?data: {type: []}<, status: "error", error: "message">}
    """
    result = {}
    body = request.body.read() or request.query_string
    try:
        if "GET" == request.method:
            args = util.parse_qs(request.query_string)
        else:
            args = util.json_loads(body or "{}")
        payload, error, status = model.poll(args, request.session["userid"], tableid)
    except urllib2.HTTPError:
        result.update(status="error", error="Access denied.")
        response.status = httplib.UNAUTHORIZED
        logger.debug("Unauthorized access to api/poll.")
    except StandardError:
        error = "Error handling poll for %s." % (body)
        result.update(status="error", error=error), logger.exception(error)
        response.status = httplib.INTERNAL_SERVER_ERROR
    else:
        if error:
            result.update(status="error", error=error)
            response.status = status
        elif payload: result["data"] = payload
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
    try:
        data = util.json_loads(request.body.read())
        user, err, status = model.data_action("users", None, request.method, data)
    except StandardError:
        err = "Registration unsuccessful."
        logger.exception(err)
        status = httplib.INTERNAL_SERVER_ERROR

    if err:
        response.status = status
        return {"status": "error", "error": err}
    else:
        request.session.update(username=user["username"], userid=user["id"],
                               login=datetime.datetime.utcnow())
        return {"status": "ok"}


@route("/api/<datatype>", method=["GET", "POST", "PUT", "DELETE"])
@route("/api/<datatype>/<path:path>", method=["GET", "POST", "PUT", "DELETE"])
@login_required
@content_type("application/json")
def api_action(datatype, path=""):
    """
    Handler for data actions on REST API.

    @return  {status: "ok" or "error", data: [] or {} or None, error: "message">}
    """
    result = {}
    userid, username = map(request.session.get, ("userid", "username"))
    logger.info("API call to %s %s/%s by %s.", request.method, datatype, path, username)
    payload = err = status = None
    try:
        if "GET" == request.method:
            data = util.parse_qs(request.query_string)
        else:
            data = util.json_loads(request.body.read() or request.query_string or "null")
            if data: result["status"] = "ok"

        payload, err, status = model.data_action(datatype, path, request.method, data, userid)
    except Exception:
        err = "Error handling query for %s." % "/".join(filter(bool, (datatype, path)))
        status = httplib.INTERNAL_SERVER_ERROR
        logger.exception(err)
    if err: result.update(status="error", error=err)
    elif payload: result.update(data=payload)
    if status: response.status = status
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
    translations = translate.get_all()
    schema = conf.DbSchema

    userid = request.session.get("userid")
    try:
        data, error, status = model.pagedata(request, "table", userid, shortid=shortid)
    except Exception as e:
        logger.exception("Error loading table data.")
        error, status = str(e), httplib.INTERNAL_SERVER_ERROR
    if error:
        raise bottle.HTTPError(status, error)

    poll = {"url": "poll/%s" % data["tables"][0]["id"], "interval": conf.PollInterval}
    return bottle.template("table.tpl", locals())


@route("/")
def index():
    """Handler for showing the index or login page."""
    translations = translate.get_all()
    schema = conf.DbSchema
    root = request.app.get_url("/")

    userid = request.session.get("userid")
    if not userid:
        data, e, s = model.pagedata(request, "login")
        return bottle.template("login.tpl", locals(), schema=conf.DbSchema)

    data, e, s = model.pagedata(request, "index", userid)
    poll = {"url": "poll", "interval": conf.PollInterval}
    return bottle.template("index.tpl", locals())


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
    logger.info("Using configuration file %s.", configfile)
    util.ini_load(configfile, conf)
    util.init_logger(conf.LogLevel, conf.LogPath, conf.ErrorLogPath,
                     conf.LogFormat, conf.LogExclusions)
    translate.init(conf.DefaultLanguage, conf.TranslationTemplate, conf.AutoReload)
    model.init(conf.DbSchema, conf.DbPath, conf.DbStatements)

    bottle.route("/<url:path>", unsupported) # Add after plugin endpoints

    sys.path.append(conf.RootPath)
    myapp = bottle.default_app()
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
