Deckathlon
==========

A card game website engine. Users can register an account, create their own 
game table, or join an existing one as player or spectator.

Comes installed with a few game templates, more can be added.

[![Screenshot](https://raw.github.com/suurjaak/Deckathlon/gh-pages/img/th_screen_thousand.png)](https://raw.github.com/suurjaak/Deckathlon/gh-pages/img/screen_thousand.png)


Installation
------------

Install Python and pip, run `pip install -r requirements.txt` in deckathlon folder.

By default, Deckathlon uses SQLite as database engine, created automatically.
To use Postgres, create the database, populate it with `deckathlon/etc/db/postgres.sql`,
and add at least the following to `deckathlon/etc/deckatlhon.ini`:

    DbEngine = "postgres"
    DbOpts.database = "myname"
    DbOpts.username = "myuser"



Running The Program
-------------------

Deckathlon can be run as a stand-alone web server:

    python -m deckathlon

Or under a WSGI-supporting web server like Apache, see `deckathlon.wsgi`.



Games
-----

Full game descriptions at https://suurjaak.github.io/Deckathlon/games.html

Game engine is described in [ENGINE.md](ENGINE.md).

#### Thousand

A trick-taking game for 3-4 players, with a bidding phase and a playing phase. 
Played with a deck of 24 cards, from nines to aces. The goal is to be the
first player who reaches 1000 points.

Very engaging, highly popular in Eastern Europe. Can last for hours,
rarely less than one hour.


#### Arschloch

A game for 3-7 players, with winners and losers exchanging cards in consecutive games. 
Played with a full deck of 55 cards, all cards from twos to aces to jokers. In each 
game set, the goal is to empty own hand first; player finishing first is the 
winner and player finishing last the loser. 

Simple rules, highly addictive and engaging. Game series can last for hours, 
or be had as a quick entertainment during a break. 

Known by many other names: Asshole, Capitalism, President, Scum. 


#### Five Sheets

A simple game for 2-8 players, with players needing to kill the previous 
card and play a card for the next player to kill. Played with a deck of 52 
cards, from twos to aces. The goal is to empty own hand first; player finishing 
first is the winner and player finishing last the loser.


Localization
------------

Uses Portable Object (.po) files, residing under `deckathlon/etc/i18n`,
language selection specified in configuration.

Game templates can specify their own translations, both for template properties
like name and description plus any translation strings, in table column `templates.i18n`,
as `{language code: {"template.propertyname" or text: translation}}`.



Configuration
-------------

Default configuration file is `deckathlon/etc/deckatlhon.ini`, can be overridden
with environment variable DECKATHLONCONF specifying another path.


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
    SessionPath   = "path to login session files"
    Quiet         = True


Localization parameters:

    Languages       = ["en", "et"]
    DefaultLanguage = "en"


Logging parameters:

    LogLevel     = "DEBUG"
    LogPath      = "path to log file"
    ErrorLogPath = "path to error log file if separate from log file"


Game engine parameters:

    OfflineInterval      = 180 # Seconds after which player is considered offline
    OnlineUpdateInterval = 30  # Seconds between updating player online status
    PollInterval         = 1   # Seconds between data update poll requests



Source Dependencies
-------------------

Deckathlon needs Python 2.7,
and the following 3rd-party Python packages:

- Bottle (https://bottlepy.org,            MIT license)
- beaker (https://pypi.org/project/beaker, BSD license)
- polib  (https://pypi.org/project/polib,  MIT license)
- pytz   (https://pypi.org/project/pytz,   MIT license)

If using Postgres database engine:
- psycopg2 (https://pypi.org/project/psycopg2, LGPL)



Attribution
===========

Includes font DejaVu Sans, CC BY-NC-ND 4.0,
https://github.com/web-fonts/dejavu-sans, vendored under `static/media/`.

Uses Vue.js (https://github.com/vuejs/vue, MIT license),
(c) 2013 Yuxi (Evan) You, vendored under `static/vendor/`.

Uses drawdown (https://github.com/adamvleggett/drawdown, MIT license),
(c) 2016 Adam Leggett, vendored under `static/vendor/`.

Site favicon from Fugue Icons,
(c) 2010 Yusuke Kamiyamane, https://p.yusukekamiyamane.com.



License
-------

Copyright (c) 2020 by Erki Suurjaak.
Released as free open source software under the MIT License,
see [LICENSE.md](LICENSE.md) for full license text.
