Deckathlon
==========

A card game website. Users can register an account, create their own game table, 
or join an existing one as player or spectator.

Comes installed with two game templates.



Installation
------------

Install Python and pip, run `pip install -r requirements.txt` in deckathlon folder.

By default, Deckathlon uses SQLite as database engine, created automatically.
To use Postgres, create the database, populate it with `etc/db/postgres.sql`,
and add at least the following to `etc/deckatlhon.ini`:

    DbEngine = "postgres"
    DbOpts.database = "myname"
    DbOpts.username = "myuser"



Running The Program
-------------------

Deckathlon can be run as a stand-alone web server:

   python -m deckathlon.index

Or under a WSGI-supporting web server like Apache, see `deckathlon.wsgi`.



Localization
------------

Uses Portable Object (.po) files, residing under `deckathlon/etc/i18n`,
language selection specified in configuration.

Translations can be game template-specific, with identifiers in the form
`template__TEMPLATENAME__TEXT`. For example, `template__Thousand__Thousand`
would hold the translated name for game template "Thousand".



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



Game Template
-------------

Cards are represented as two-character strings, with first character being
card level and second being card suite, e.g. "AS" for ace of spades.
Levels are 234567890JQKAX (with 0 being 10 and X being joker),
suites are HSDCX (hearts, spades, diamonds, clubs, jokers).

Jokers are represented as "XX" "YX" "ZX", so that all cards are unique.


Each game is described with a configuration template:

    {
        "cards":              list of cards in deck, as ["3H", "3S", "3D", "3C", ..];
        "strengths":          card strength order in ascending order, as "34567890JQKA2X";
        "suites":             suite strength order in ascending order, as "HSDCX";
        "players":            number of supported players, as [min, max] or single number for [1, max];
        "hand":               maximum number of cards in hand in the beginning;
        "sort":               card comparison order, as ["strength", "suite"] or a single "strength" or "suite";

        "discards":           whether game has a discard pile;
        "reveal":             whether all cards are revealed at the end;

        "talon": {            if game has talon:
            "face":           whether talon is face up;
        },
        "trick":              whether game is a trick-taking game,
                              with each player playing one card per round;
        "trump":              whether game has trump suite;

        "bidding": {          if game has bidding:
            "min":            bid minimum number;

            "max":            bid maximum number, as single value or {
                "*":              default maximum,
                "blind":          maximum when bidding blind,
                "trump":          maximum when have trump cards in hand,
            },

            "step":           minimum step when overbidding last bid;
            "pass":           whether player can pass in bidding;
            "pass_final":     whether player can't bid any more once passed;
            "talon":          whether bid winner takes talon;
            "sell":           whether bid winner can put talon on sale;
            "distribute":     whether bid winner distributes cards to other
                              players for everyone to have equal number of cards;
            "blind":          whether game supports blind bidding (without looking at own hand);
        },

        "lead": {
            "0":              leader of first round, as "bidder" for player winning bid;
                              as {"ranking": -1} for player position in current table ranking;
                              by default the player next to last game's first leader;
            "*":              leader of consecutive rounds, "trick" for player winning last trick;
        },

        "move": {
            "cards":          number of cards in a move, or "*" for any number;
            "level":          whether move cards needs to be at same level;
            "pass":           whether player can pass;
            "crawl":          round number when player can crawl (play card face down,
                              with next players making their move face down as well),

            "response": {
                "level":      whether next player needs to match the card level of previous move;
                "suite":      whether next player needs to follow the card suite of previous move;
                "amount":     whether next player needs to match the number of cards in previous move;
            },

            "win": {          for non-trick-taking games:
              "last":         whether round if won by being last player to play in round;
              "level":        "all" if round is won by having all cards of one level on table;
            }
            "win": {          for trick-taking games:
              "suite":        whether round is won by following the suite of first move;
              "level":        whether round is won by defeating the level of first move;
            }

            "special": {      special moves:
              "trump": {      if player can make trump on move:
                "condition":  {"cards": 3} if player needs to have a minimum number of cards in hand,
                "0":          whether player can make this move on first turn,
                "*":          sets of cards needed to make this move,
                              as [["KD", "QD"], ["KH", "QH"], ["KS", "QS"], ["KC", "QC"]];
              },
              "some other":   some other special move than trump:
                "condition":  {"opt": "trump", "suite": true} if trump needs to have been made
                              and move needs to follow trump suite;
                "0":          whether player can make this move on first turn;
                "*":          sets of cards needed to make this move,
                              as [["AD", "0D"], ["AH", "0H"], ["AS", "0S"], ["AC", "0C"]];
              }
            },
        },

        "ranking": {
            "finish":         whether game ranking is determined by order of finishing all cards in hand;
        },

        "nextgame": {
            "distribute": {   next game starts with exchanging cards between winning and losing players,
                              with losing players needing to give their best cards,
                              winning players able to give any cards:
                "ranking":    whether cards are distributed by ranking order;
                "max":        number of cards the biggest winner and loser exchange,
                              next player pair in ranking line will give one less etc;
            }
        },

        "complete": {         condition for winning the game series:
          "score":            minimum score needed to win game series;
        },

        "redeal": {           players can demand redeal at game start:
            "condition": {
                "hand":       cards in hand required for redeal, as ["9H", "9S", "9D", "9C"];
                "min":        minimum number of said cards required;
            }
        },

        "points": {           points scoring:
          "trick":            for trick-taking games, points that card levels give,
                              as {"9": 0, "0": 10, "J": 2, "Q": 3, "K": 4, "A": 11};

          "special": {        points for special moves like trump:

              "trump": {          points for making a trump of specific suite:
                "D":  40,
                "H":  60,
                "S":  80,
                "C": 100
              },
              "some other":       points for making some other special move;
          },

          "bonuses": {        bonuses for conditions like bidding blind:
              "blind":        arithmetic operation to apply to score on succeeding to meet
                              the point score of a blind bid,
                              as {"op": "mul", "value": 2} for doubling score;
          },
          "penalties": {      penalties for various conditions:
            "bid":            arithmetic operation to apply to score on failing to meet
                              the point score of a bid,
                              as {"op": "mul", "value": -1} for getting negative the points bid,
            "blind":          arithmetic operation to apply to score on failing to meet
                              the point score of a blind bid,
                              as {"op": "mul", "value": -2} for burning double the points bid;
            "nochange": {     penalty for having no change in points for several games:
                "times":      number of consecutive games required for penalty;
                "op":         arithmetic operation to apply to score, like "mul" or "add";
                "value":      value to use in arithmetic operation;
            }
          },

          "bidonly": {        condition where player can get points from bids only:
              "min":          minimum score from which player can no longer get points from tricks et al;
          }
        },

    }



Source Dependencies
-------------------

Deckathlon needs Python 2.7,
and the following 3rd-party Python packages:

- Bottle (https://bottlepy.org,               MIT license)
- beaker (https://github.com/bbangert/beaker, BSD license)
- polib  (https://bitbucket.org/izi/polib,    MIT license)
- pytz   (https://pythonhosted.org/pytz/,     MIT license)

If using Postgres database engine:
- psycopg2 (https://github.com/psycopg/psycopg2, LGPL)




Attribution
===========

Includes font DejaVu Sans, CC BY-NC-ND 4.0,
https://github.com/web-fonts/dejavu-sans, vendored under `static/media/`.

Uses Vue.js 2.6.11 (https://github.com/vuejs/vue, MIT license),
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
