# -*- coding: utf-8 -*-
"""
Configuration settings. Can read additional/overridden options from INI file,
supporting any JSON-serializable datatype, as well as Python literal eval.

@author      Erki Suurjaak
@created     18.04.2020
@modified    03.05.2020
"""
import os
import sys

"""Program version."""
Title = "Deckathlon"
Name = "deckathlon"
Version = "0.1"
VersionDate = "03.05.2019"

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

"""Default UI language in the web interface."""
DefaultLanguage = "en"

"""Template for Portable Object pathnames with language code placeholder."""
TranslationTemplate = os.path.join(RootPath, "etc", "i18n", "%s.%%s.po" % Name)

"""Default IP address and TCP port to run on."""
ServerIP = "0.0.0.0"
ServerPort = 9000

"""Web server backend, e.g. paste. Simple built-in default: wsgiref."""
ServerBackend = "wsgiref"

"""Options passed to the web server backend, like "ssl_pem"."""
ServerBackendOptions = {}

"""Data polling interval, in milliseconds."""
PollInterval = 1000

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

"""Local SQLite database path and init statements."""
DbPath = os.path.join(RootPath, "var", "%s.db" % Name)
DbStatements = (

    """
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
      username   TEXT      NOT NULL CHECK (LENGTH(username) > 0),
      password   TEXT      NOT NULL CHECK (LENGTH(password) > 0),
      dt_online  TIMESTAMP DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now')),
      dt_created TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now')),
      dt_changed TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now'))
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS templates (
        id         INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL, 
        fk_creator INTEGER   REFERENCES users (id), 
        name       TEXT      NOT NULL UNIQUE CHECK (LENGTH(name) > 0), 
        opts       JSON      NOT NULL DEFAULT '{}', 
        dt_created TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now')), 
        dt_changed TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now')),
        dt_deleted TIMESTAMP
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS tables (
      id             INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
      fk_creator     INTEGER   NOT NULL REFERENCES users (id),
      fk_host        INTEGER   NOT NULL REFERENCES users (id),
      fk_template    INTEGER   NOT NULL REFERENCES templates (id),
      name           TEXT      NOT NULL,
      shortid        TEXT      NOT NULL UNIQUE,
      public         INTEGER   NOT NULL DEFAULT 0,
      games          INTEGER   NOT NULL DEFAULT 0,
      players        INTEGER   NOT NULL DEFAULT 0,
      status         TEXT      DEFAULT 'new',
      bids           JSON      NOT NULL DEFAULT '[]',
      scores         JSON      NOT NULL DEFAULT '[]',
      scores_history JSON      NOT NULL DEFAULT '[]',
      dt_created     TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now')),
      dt_changed     TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now'))
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS table_users (
        id         INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL, 
        fk_table   INTEGER   NOT NULL REFERENCES tables (id), 
        fk_user    INTEGER   NOT NULL REFERENCES users (id), 
        dt_online  TIMESTAMP DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now')),
        dt_created TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now')),
        dt_changed TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now')),
        dt_deleted TIMESTAMP
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS games (
        id         INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL, 
        fk_table   INTEGER   NOT NULL REFERENCES tables (id), 
        fk_player  INTEGER   REFERENCES players (id), 
        sequence   INTEGER   NOT NULL DEFAULT 0, 
        status     TEXT      NOT NULL DEFAULT 'new', 
        opts       JSON      NOT NULL DEFAULT '{}', 
        deck       JSON      NOT NULL DEFAULT '[]', 
        hands      JSON      NOT NULL DEFAULT '{}', 
        talon      JSON      NOT NULL DEFAULT '[]', 
        talon0     JSON      NOT NULL DEFAULT '[]', 
        bids       JSON      NOT NULL DEFAULT '[]', 
        bid        JSON      NOT NULL DEFAULT '{}', 
        tricks     JSON      NOT NULL DEFAULT '[]', 
        trick      JSON      NOT NULL DEFAULT '[]', 
        moves      JSON      DEFAULT '[]', 
        discards   JSON      NOT NULL DEFAULT '[]', 
        score      JSON      NOT NULL DEFAULT '{}', 
        dt_created TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now')), 
        dt_changed TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now'))
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS players (
        id         INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL, 
        fk_table   INTEGER   NOT NULL REFERENCES tables (id), 
        fk_game    INTEGER   REFERENCES games (id), 
        fk_user    INTEGER   NOT NULL REFERENCES users (id), 
        sequence   INTEGER   NOT NULL DEFAULT 0, 
        status     TEXT, 
        expected   JSON      DEFAULT '{}', 
        hand       JSON      NOT NULL DEFAULT '[]', 
        hand0      JSON      NOT NULL DEFAULT '[]', 
        moves      JSON      NOT NULL DEFAULT '[]', 
        tricks     JSON      NOT NULL DEFAULT '[]', 
        dt_created TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now')), 
        dt_changed TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now')),
        dt_deleted TIMESTAMP
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS log (
        id         INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL, 
        action     TEXT, 
        data       JSON, 
        dt_created TIMESTAMP DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now'))
    )
    """,

    """
    CREATE TRIGGER IF NOT EXISTS on_update_games AFTER UPDATE ON games
    BEGIN
    UPDATE games SET dt_changed = STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now') WHERE id = NEW.id;
    END;
    """,

    """
    CREATE TRIGGER IF NOT EXISTS on_update_players AFTER UPDATE ON players
    BEGIN
    UPDATE players SET dt_changed = STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now') WHERE id = NEW.id;
    END;
    """,

    """
    CREATE TRIGGER IF NOT EXISTS on_update_tables AFTER UPDATE ON tables
    BEGIN
    UPDATE tables SET dt_changed = STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now') WHERE id = NEW.id;
    END;
    """,

    """
    CREATE TRIGGER IF NOT EXISTS on_update_templates AFTER UPDATE ON templates
    BEGIN
    UPDATE templates SET dt_changed = STRFTIME('%Y-%m-%d %H:%M:%fZ', 'now') WHERE id = NEW.id;
    END;
    """,

    "INSERT OR IGNORE INTO users (id, username, password) VALUES (1, 'admin', '0fb57789d87a97f7949ab902b3f2d8001acb6ddea7b4fc0b46a4681124245f4e')",
)
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
            "dt_created":  {},
            "dt_changed":  {},
        },
        "fklabel": "name",
        "order":   "name",
    },

    "tables": {
        "key":     "id",
        "fields":  {
            "id":          {},
            "fk_host":     {"fk": "users"},
            "fk_template": {"fk": "templates"},
            "name":        {},
            "shortid":     {},
            "public":      {},
            "sequence":    {},
            "status":      {},
            "games":       {},
            "players":     {},
            "status":      {},
            "bids":        {},
            "scores":      {},
            "dt_created":  {},
            "dt_changed":  {},
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
            "moves":       {},
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
            "moves":       {},
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

    "actions": {
        "virtual": True,
    },

    "settings": {
        "single":  True,
        "virtual": True,
    },

}
