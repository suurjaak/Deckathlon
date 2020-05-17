-- Schema for SQLite.
--
-- ------------------------------------------------------------------------------
-- This file is part of Deckathlon - card game website.
-- Released under the MIT License.
--
-- @author    Erki Suurjaak
-- @created   08.05.2020
-- @modified  17.05.2020

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
  username   TEXT      NOT NULL CHECK (LENGTH(username) > 0),
  password   TEXT      NOT NULL CHECK (LENGTH(password) > 0),
  dt_created TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now')),
  dt_changed TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now'))
);


CREATE TABLE IF NOT EXISTS games (
  id         INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
  fk_table   INTEGER   NOT NULL REFERENCES tables (id),
  fk_player  INTEGER   REFERENCES players (id),
  series     INTEGER   NOT NULL DEFAULT 0,
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
  dt_created TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now')),
  dt_changed TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now'))
);


CREATE TABLE IF NOT EXISTS log (
  id         INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
  fk_user    INTEGER   REFERENCES users (id),
  action     TEXT,
  data       JSON,
  dt_created TIMESTAMP DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now'))
);


CREATE TABLE IF NOT EXISTS online (
  id         INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
  fk_user    INTEGER   NOT NULL REFERENCES users (id),
  fk_table   INTEGER   REFERENCES tables (id),
  active     INTEGER   NOT NULL DEFAULT 1,
  dt_online  TIMESTAMP DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now')),
  dt_created TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now')),
  dt_changed TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now')),
  UNIQUE (fk_user, fk_table)
);


CREATE TABLE IF NOT EXISTS players (
  id         INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
  fk_table   INTEGER   NOT NULL REFERENCES tables (id),
  fk_game    INTEGER   REFERENCES games (id),
  fk_user    INTEGER   REFERENCES users (id),
  sequence   INTEGER   NOT NULL DEFAULT 0,
  status     TEXT,
  expected   JSON      DEFAULT '{}',
  hand       JSON      NOT NULL DEFAULT '[]',
  hand0      JSON      NOT NULL DEFAULT '[]',
  moves      JSON      NOT NULL DEFAULT '[]',
  tricks     JSON      NOT NULL DEFAULT '[]',
  dt_created TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now')),
  dt_changed TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now')),
  dt_deleted TIMESTAMP
);


CREATE TABLE IF NOT EXISTS requests (
  id         INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
  fk_user    INTEGER   NOT NULL REFERENCES users (id),
  fk_table   INTEGER   NOT NULL REFERENCES tables (id),
  fk_game    INTEGER   REFERENCES games (id),
  type       TEXT      NOT NULL,
  status     TEXT      NOT NULL DEFAULT 'new',
  opts       JSON      NOT NULL DEFAULT '{}',
  public     INTEGER   NOT NULL DEFAULT 0,
  dt_created TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now')),
  dt_changed TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now'))
);


CREATE TABLE IF NOT EXISTS table_users (
  id         INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
  fk_table   INTEGER   NOT NULL REFERENCES tables (id),
  fk_user    INTEGER   NOT NULL REFERENCES users (id),
  dt_created TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now')),
  dt_changed TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now')),
  dt_deleted TIMESTAMP
);


CREATE TABLE IF NOT EXISTS tables (
  id             INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
  fk_creator     INTEGER   NOT NULL REFERENCES users (id),
  fk_host        INTEGER   NOT NULL REFERENCES users (id),
  fk_template    INTEGER   NOT NULL REFERENCES templates (id),
  name           TEXT      NOT NULL,
  shortid        TEXT      NOT NULL UNIQUE,
  public         INTEGER   NOT NULL DEFAULT 0,
  opts           JSON      NOT NULL DEFAULT '{}',
  series         INTEGER   NOT NULL DEFAULT 0,
  games          INTEGER   NOT NULL DEFAULT 0,
  players        INTEGER   NOT NULL DEFAULT 0,
  status         TEXT      DEFAULT 'new',
  bids           JSON      NOT NULL DEFAULT '[]',
  scores         JSON      NOT NULL DEFAULT '[]',
  bids_history   JSON      NOT NULL DEFAULT '[]',
  scores_history JSON      NOT NULL DEFAULT '[]',
  dt_created     TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now')),
  dt_changed     TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now'))
);


CREATE TABLE IF NOT EXISTS templates (
  id         INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
  fk_creator INTEGER   REFERENCES users (id),
  name       TEXT      NOT NULL UNIQUE CHECK (LENGTH(name) > 0),
  opts       JSON      NOT NULL DEFAULT '{}',
  dt_created TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now')),
  dt_changed TIMESTAMP NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now')),
  dt_deleted TIMESTAMP
);


CREATE TRIGGER IF NOT EXISTS on_update_games AFTER UPDATE ON games
BEGIN
UPDATE games SET dt_changed = STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now') WHERE id = NEW.id;
END;


CREATE TRIGGER IF NOT EXISTS on_update_online AFTER UPDATE ON online
BEGIN
UPDATE online SET dt_changed = STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now') WHERE id = NEW.id;
END;


CREATE TRIGGER IF NOT EXISTS on_update_players AFTER UPDATE ON players
BEGIN
UPDATE players SET dt_changed = STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now') WHERE id = NEW.id;
END;


CREATE TRIGGER IF NOT EXISTS on_update_requests AFTER UPDATE ON requests
BEGIN
UPDATE requests SET dt_changed = STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now') WHERE id = NEW.id;
END;


CREATE TRIGGER IF NOT EXISTS on_update_tables AFTER UPDATE ON tables
BEGIN
UPDATE tables SET dt_changed = STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now') WHERE id = NEW.id;
END;


CREATE TRIGGER IF NOT EXISTS on_update_templates AFTER UPDATE ON templates
BEGIN
UPDATE templates SET dt_changed = STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now') WHERE id = NEW.id;
END;


CREATE TRIGGER IF NOT EXISTS on_update_users AFTER UPDATE ON users
BEGIN
UPDATE users SET dt_changed = STRFTIME('%Y-%m-%d %H:%M:%f000+00:00', 'now') WHERE id = NEW.id;
END;


INSERT OR IGNORE INTO templates (name, opts, dt_created, dt_changed) VALUES ('Tuhat', '{"sort": ["suite", "strength"], "suites": "HSDC", "redeal": {"condition": {"hand": ["9H", "9S", "9D", "9C"], "min": 3}}, "trump": true, "lead": {"0": "bidder", "*": "trick"}, "talon": {"face": false}, "move": {"win": {"suite": true, "level": true}, "pass": false, "cards": 1, "crawl": 0, "response": {"suite": true}, "special": {"wheels": {"0": false, "*": [["AD", "0D"], ["AH", "0H"], ["AS", "0S"], ["AC", "0C"]], "condition": {"opt": "trump", "suite": true}}, "trump": {"0": false, "*": [["KD", "QD"], ["KH", "QH"], ["KS", "QS"], ["KC", "QC"]], "condition": {"cards": 3}}}}, "reveal": true, "hand": 7, "trick": true, "players": [3, 4], "points": {"bidonly": {"min": 900}, "special": {"trump": {"C": 100, "H": 60, "S": 80, "D": 40}, "wheels": 120}, "penalties": {"blind": {"value": -2, "op": "mul"}, "nochange": {"op": "add", "value": -100, "times": 3}, "bid": {"value": -1, "op": "mul"}}, "trick": {"A": 11, "K": 4, "J": 2, "Q": 3, "0": 10, "9": 0}, "bonuses": {"blind": {"value": 2, "op": "mul"}}}, "bidding": {"sell": true, "blind": true, "min": 60, "max": {"blind": 120, "*": 120, "trump": 340}, "distribute": true, "pass_final": true, "talon": true, "step": 5, "pass": true}, "pass": false, "cards": ["9S", "9H", "9D", "9C", "JS", "JH", "JD", "JC", "QS", "QH", "QD", "QC", "KS", "KH", "KD", "KC", "0S", "0H", "0D", "0C", "AS", "AH", "AD", "AC"], "strengths": "9JQK0A", "order": true, "complete": {"score": 1000}}', '2020-04-18 22:07:23.000000+00:00', '2020-05-03 18:01:29.635000+00:00');

INSERT OR IGNORE INTO templates (name, opts, dt_created, dt_changed) VALUES ('Arschloch', '{"sort": "strength", "suites": "HSDCX", "lead": {"0": {"ranking": -1}, "*": "trick"}, "discards": true, "move": {"cards": "*", "win": {"last": true, "level": "all"}, "pass": true, "response": {"amount": true, "level": true}, "level": true}, "hand": 19, "players": [3, 7], "ranking": {"finish": true}, "nextgame": {"distribute": {"ranking": true, "max": 3}}, "cards": ["3S", "3H", "3D", "3C", "4S", "4H", "4D", "4C", "5S", "5H", "5D", "5C", "6S", "6H", "6D", "6C", "7S", "7H", "7D", "7C", "8S", "8H", "8D", "8C", "9S", "9H", "9D", "9C", "0S", "0H", "0D", "0C", "JS", "JH", "JD", "JC", "QS", "QH", "QD", "QC", "KS", "KH", "KD", "KC", "AS", "AH", "AD", "AC", "2S", "2H", "2D", "2C", "XX", "YX", "ZX"], "strengths": "34567890JQKA2X", "reveal": false}', '2020-05-03 19:46:23.843000+00:00', '2020-05-08 21:10:13.930000+00:00');
