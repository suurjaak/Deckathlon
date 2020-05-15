Deckathlon
==========

A card game website. Users can register, create a game table or join an existing
one.



Installation
------------

Install Python and pip, run `pip install -r requirements.txt` in deckathlon folder.

By default, Deckathlon uses SQLite as database engine, created automatically.
To use Postgres, create the database, populate it with `etc/db/postgres.sql`,
and add at least the following to `etc/deckatlhon.ini`:

    DbEngine = "postgres"
    DbOpts.database = "myname"
    DbOpts.username = "myuser"

Comes installed with two game templates.



Running The Program
-------------------

Deckathlon can be run as a stand-alone web server:

   python -m deckathlon.index

Or under a WSGI-supporting web server like Apache.



Localization
------------

Uses Portable Object (.po) files, residing under `deckathlon/etc/i18n`,
language selection specified in configuration.



Configuration
-------------

SQLite parameters:

    DbEngine = "sqlite"
    DbOpts = "path to SQLite db"


Postgres parameters:

    DbEngine = "postgres"
    DbOpts.database = "myname"
    DbOpts.username = "myuser"
    DbOpts.password = "mypass"
    DbOpts.host     = "localhost"
    DbOpts.port     = 5432
    DbOpts.minconn  = 1
    DbOpts.maxconn  = 4


Web server parameters:

    ServerIP      = "0.0.0.0"
    ServerPort    = 9000
    ServerPrefix  = "extra prefix if using reverse proxy"
    ServerBackend = "wsgiref or paste or cherrypy etc if running as stand-alone"
    SessionPath   = "path to HTTP session files"
    Quiet         = True


Localization parameters:

  Languages       = ["en", "et"]
  DefaultLanguage = "en"


Logging parameters:

    LogLevel     = "DEBUG"
    LogPath      = "path to log file"
    ErrorLogPath = "path to error log file if separate from log file"


Game engine parameters:

  OfflineInterval      = 180
  OnlineUpdateInterval = 30
  PollInterval         = 1



Source Dependencies
-------------------

Deckathlon needs Python 2.7,
and the following 3rd-party Python packages:

- Bottle (https://bottlepy.org, MIT license)
- beaker (https://github.com/bbangert/beaker, BSD license)
- polib  (https://bitbucket.org/izi/polib,    MIT license)
- pytz   (https://pythonhosted.org/pytz/,      MIT license)



Attribution
===========

Includes font DejaVu Sans, CC BY-NC-ND 4.0,
https://github.com/web-fonts/dejavu-sans.

Site favicon from Fugue Icons,
(c) 2010 Yusuke Kamiyamane, https://p.yusukekamiyamane.com.



License
-------

Copyright (c) 2020 by Erki Suurjaak.
Released as free open source software under the MIT License,
see [LICENSE.md](LICENSE.md) for full license text.
