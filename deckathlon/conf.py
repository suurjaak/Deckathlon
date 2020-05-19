# -*- coding: utf-8 -*-
"""
Configuration settings. Can read additional/overridden options from INI file,
supporting any JSON-serializable datatype, as well as Python literal eval.

------------------------------------------------------------------------------
This file is part of Deckathlon - card game website.
Released under the MIT License.

@author      Erki Suurjaak
@created     18.04.2020
@modified    18.05.2020
"""
import os

"""Program version."""
Title = "Deckathlon"
Name = "deckathlon"
Version = "0.1.dev27"
VersionDate = "18.05.2019"

"""Application code root path."""
RootPath = ApplicationPath = os.path.dirname(os.path.abspath(__file__))

"""Path for variable application files, like database and log files."""
VarPath = os.path.join(RootPath, "var")

"""Path for static web content, like images and JavaScript files."""
StaticPath = os.path.join(RootPath, "static")

"""Sessiondata path for beaker middleware."""
SessionPath = os.path.join(RootPath, "tmp")

"""Path for HTML templates."""
TemplatePath = os.path.join(RootPath, "views")

"""UI languages supported in the web interface."""
Languages = ["en", "et"]

"""Default UI language in the web interface."""
DefaultLanguage = "en"

"""Template for Portable Object pathnames with language code placeholder."""
TranslationTemplate = os.path.join(RootPath, "etc", "i18n", "%s.%%s.po" % Name)

"""Website prefix (e.g. for reverse proxy or the like)."""
ServerPrefix = ""

"""Default IP address and TCP port to run on."""
ServerIP = "0.0.0.0"
ServerPort = 9000

"""Web server backend, e.g. paste. Simple built-in default: wsgiref."""
ServerBackend = "wsgiref"

"""Options passed to the web server backend, like "ssl_pem"."""
ServerBackendOptions = {}

"""Data polling interval, in seconds."""
PollInterval = 1

"""Time after last request when user is considered offline, in seconds"""
OfflineInterval = 180

"""Interval after which online-flag gets updated in db, in seconds"""
OnlineUpdateInterval = 30

"""Secret key for login and password hashes."""
SecretKey = "d02edd84-8acd-430a-b764-89064295cc75"

"""Whether modules and templates and translations are automatically reloaded on change."""
AutoReload = False

"""Whether web server output to stdout/stderr is suppressed."""
Quiet = True

"""Logging configuration. Disabled if empty paths given."""
LogPath = os.path.join(VarPath, "%s.log" % Name)
ErrorLogPath = os.path.join(VarPath, "error.log")
LogLevel = "DEBUG" # CRITICAL|ERROR|WARNING|INFO|DEBUG|NOTSET
LogFormat = "%(asctime)s\t%(levelname)s\t%(module)s:%(lineno)s\t%(message)s"
LogExclusions = [] # List of modules to exclude from logging

"""Database engine used, "sqlite" or "postgres"."""
DbEngine = "sqlite"

"""Database options: local SQLite database path if "sqlite" engine."""
DbOpts = os.path.join(RootPath, "var", "%s.db" % Name)

"""
Data description.

datatype: {
  "key":           primary key field name,
  "fields": {
    fieldname: {
      "type":      value type like "date",
      "fk":        name of the foreign table this field references, if any,
      "fklabel":   one or more field names to use from foreign table as display value,
      "fkformat":  foreign label format, defaults to "{0}" for single label, "{0} ({1} .. {N})" for N fields,
      "drop":      drop when giving to UI,
      "adapt":     function(value, row, userid) returning field value,
    },
  },
  "fklabel":       one or more field names to use as display value in foreign tables,
  "fkformat":      foreign label format, defaults to "{0}" for single label, "{0} ({1} .. {N})" for N fields,
  "order":         field to order by, if any,
  "single":        true if the type is a singular type with only one item,
  "virtual":       true if the type is not stored anywhere,
}
"""
DbSchema = {

    "users": {
        "key":     "id",
        "fields":  {
            "id":          {},
            "username":    {},
            "password":    {"drop": True},
            "dt_created":  {},
        },
        "fklabel": "username",
        "order":   "username",
    },

    "user": {
        "key":     "id",
        "fields":  {
            "id":          {},
            "username":    {},
            "password":    {"drop": True},
            "dt_created":  {},
        },
        "single":  True,
        "table":   "users",
    },

    "templates": {
        "key":     "id",
        "fields":  {
            "id":          {},
            "fk_creator":  {"fk": "users"},
            "name":        {},
            "opts":        {},
            "description": {},
            "dt_created":  {},
            "dt_changed":  {},
        },
        "fklabel": "name",
        "order":   "name",
    },

    "tables": {
        "key":     "id",
        "fields":  {
            "id":             {},
            "fk_host":        {"fk": "users"},
            "fk_template":    {"fk": "templates"},
            "name":           {},
            "shortid":        {},
            "public":         {},
            "opts":           {},
            "sequence":       {},
            "status":         {},
            "games":          {},
            "players":        {},
            "bids":           {},
            "scores":         {},
            "bids_history":   {},
            "scores_history": {},
            "users":          {},
            "dt_created":     {},
            "dt_changed":     {},
        },
        "fklabel": "name",
        "order":   ["public", "name"],
    },

    "games": {
        "key":     "id",
        "fields":  {
            "id":          {},
            "fk_table":    {"fk": "tables"},
            "fk_player":   {"fk": "players"},
            "sequence":    {},
            "status":      {},
            "opts":        {},
            "deck":        {},
            "talon":       {},
            "talon0":      {},
            "bids":        {},
            "bid":         {},
            "tricks":      {},
            "trick":       {},
            "moves":       {"drop": True},
            "discards":    {},
            "score":       {},
            "dt_created":  {},
            "dt_changed":  {},
        },
        "fklabel": "name",
        "order":   "name",
    },

    "players": {
        "key":     "id",
        "fields":  {
            "id":          {},
            "fk_table":    {"fk": "tables"},
            "fk_game":     {"fk": "games"},
            "fk_user":     {"fk": "users"},
            "sequence":    {},
            "status":      {},
            "expected":    {},
            "hand":        {},
            "hand0":       {},
            "moves":       {"drop": True},
            "tricks":      {},
            "dt_created":  {},
            "dt_changed":  {},
        },
        "order":   "sequence",
    },

    "table_users": {
        "key":     "id",
        "fields":  {
            "id":          {},
            "fk_table":    {"fk": "tables"},
            "fk_user":     {"fk": "users"},
            "dt_created":  {},
        },
    },

    "online": {
        "key":     "id",
        "fields":  {
            "id":          {},
            "fk_user":     {"fk": "users"},
            "fk_table":    {"fk": "tables"},
            "active":      {},
            "dt_online":   {},
        },
    },

    "requests": {
        "key":     "id",
        "fields":  {
            "id":          {},
            "fk_user":     {"fk": "users"},
            "fk_table":    {"fk": "tables"},
            "fk_game":     {"fk": "games"},
            "type":        {},
            "status":      {},
            "opts":        {},
        },
    },

    "actions": {
        "virtual": True,
    },

    "settings": {
        "single":  True,
        "virtual": True,
    },

}
