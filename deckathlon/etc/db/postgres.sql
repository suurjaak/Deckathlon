-- Schema for Postgres.
--
-- ------------------------------------------------------------------------------
-- This file is part of Deckathlon - card game website.
-- Released under the MIT License.
--
-- @author    Erki Suurjaak
-- @created   08.05.2020
-- @modified  21.05.2020

CREATE OR REPLACE FUNCTION update_row_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.dt_changed = now();
    RETURN NEW;
END;
$$;


CREATE TABLE games (
  id         BIGSERIAL,
  fk_table   BIGINT    NOT NULL,
  fk_player  BIGINT,
  series     INTEGER   NOT NULL DEFAULT 0,
  sequence   BIGINT    NOT NULL DEFAULT 0,
  status     TEXT      NOT NULL DEFAULT 'new',
  opts       JSONB     NOT NULL DEFAULT '{}',
  deck       JSONB     NOT NULL DEFAULT '[]',
  hands      JSONB     NOT NULL DEFAULT '{}',
  talon      JSONB     NOT NULL DEFAULT '[]',
  talon0     JSONB     NOT NULL DEFAULT '[]',
  bids       JSONB     NOT NULL DEFAULT '[]',
  bid        JSONB     NOT NULL DEFAULT '{}',
  tricks     JSONB     NOT NULL DEFAULT '[]',
  trick      JSONB     NOT NULL DEFAULT '[]',
  moves      JSONB     DEFAULT '[]',
  discards   JSONB     NOT NULL DEFAULT '[]',
  score      JSONB     NOT NULL DEFAULT '{}',
  dt_created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_changed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);


CREATE TABLE log (
  id         BIGSERIAL,
  fk_user    BIGINT,
  action     TEXT,
  data       JSONB,
  dt_created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);


CREATE TABLE online (
  id         BIGSERIAL,
  fk_user    BIGINT    NOT NULL,
  fk_table   BIGINT,
  active     BOOLEAN   NOT NULL DEFAULT TRUE,
  dt_online  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  dt_created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_changed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (fk_user, fk_table),
  PRIMARY KEY (id)
);


CREATE TABLE players (
  id         BIGSERIAL,
  fk_table   BIGINT    NOT NULL,
  fk_game    BIGINT,
  fk_user    BIGINT,
  sequence   BIGINT    NOT NULL DEFAULT 0,
  status     TEXT,
  expected   JSONB     DEFAULT '{}',
  hand       JSONB     NOT NULL DEFAULT '[]',
  hand0      JSONB     NOT NULL DEFAULT '[]',
  moves      JSONB     NOT NULL DEFAULT '[]',
  tricks     JSONB     NOT NULL DEFAULT '[]',
  dt_created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_changed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_deleted TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id)
);


CREATE TABLE requests (
  id         BIGSERIAL,
  fk_user    INTEGER   NOT NULL,
  fk_table   INTEGER   NOT NULL,
  fk_game    INTEGER,
  type       TEXT      NOT NULL,
  status     TEXT      NOT NULL DEFAULT 'new',
  opts       JSONB     NOT NULL DEFAULT '{}',
  public     BOOLEAN   NOT NULL DEFAULT FALSE,
  dt_created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_changed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);


CREATE TABLE table_users (
  id         BIGSERIAL,
  fk_table   BIGINT    NOT NULL,
  fk_user    BIGINT    NOT NULL,
  dt_created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_changed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_deleted TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id)
);


CREATE TABLE tables (
  id             BIGSERIAL,
  fk_creator     BIGINT    NOT NULL,
  fk_host        BIGINT    NOT NULL,
  fk_template    BIGINT    NOT NULL,
  name           TEXT      NOT NULL,
  shortid        TEXT      NOT NULL,
  public         BOOLEAN   NOT NULL DEFAULT FALSE,
  opts           JSONB     NOT NULL DEFAULT '{}',
  series         INTEGER   NOT NULL DEFAULT 0,
  games          BIGINT    NOT NULL DEFAULT 0,
  players        BIGINT    NOT NULL DEFAULT 0,
  status         TEXT      DEFAULT 'new',
  bids           JSONB     NOT NULL DEFAULT '[]',
  scores         JSONB     NOT NULL DEFAULT '[]',
  bids_history   JSONB     NOT NULL DEFAULT '[]',
  scores_history JSONB     NOT NULL DEFAULT '[]',
  dt_created     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_changed     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_deleted     TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id)
);


CREATE TABLE templates (
  id          BIGSERIAL,
  fk_creator  BIGINT,
  name        TEXT      NOT NULL CHECK (LENGTH(name) > 0),
  opts        JSONB     NOT NULL DEFAULT '{}',
  description TEXT      NOT NULL DEFAULT '',
  dt_created  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_changed  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_deleted  TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id)
);


CREATE TABLE users (
  id         BIGSERIAL,
  username   TEXT      NOT NULL CHECK (LENGTH(username) > 0),
  password   TEXT      NOT NULL CHECK (LENGTH(password) > 0),
  dt_created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_changed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);


ALTER TABLE games
  ADD CONSTRAINT fk_games_players      FOREIGN KEY ( fk_player   ) REFERENCES players  ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_games_tables       FOREIGN KEY ( fk_table    ) REFERENCES tables   ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE log                        
  ADD CONSTRAINT fk_log_users          FOREIGN KEY ( fk_user     ) REFERENCES users    ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE online
  ADD CONSTRAINT fk_online_tables      FOREIGN KEY ( fk_table    ) REFERENCES tables   ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_online_users       FOREIGN KEY ( fk_user     ) REFERENCES users    ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT;
                                       
ALTER TABLE players
  ADD CONSTRAINT fk_players_games      FOREIGN KEY ( fk_game     ) REFERENCES games    ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_players_tables     FOREIGN KEY ( fk_table    ) REFERENCES tables   ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_players_users      FOREIGN KEY ( fk_user     ) REFERENCES users    ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE requests
  ADD CONSTRAINT fk_requests_games      FOREIGN KEY ( fk_game     ) REFERENCES games    ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_requests_tables     FOREIGN KEY ( fk_table    ) REFERENCES tables   ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_requests_users      FOREIGN KEY ( fk_user     ) REFERENCES users    ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE table_users
  ADD CONSTRAINT fk_table_users_tables FOREIGN KEY ( fk_table    ) REFERENCES tables   ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_table_users_users  FOREIGN KEY ( fk_user     ) REFERENCES users    ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE tables
  ADD CONSTRAINT fk_tables_templates   FOREIGN KEY ( fk_template ) REFERENCES templates ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_tables_creators    FOREIGN KEY ( fk_creator  ) REFERENCES users     ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_tables_hosts       FOREIGN KEY ( fk_host     ) REFERENCES users     ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE templates
  ADD CONSTRAINT fk_templates_users    FOREIGN KEY ( fk_creator  ) REFERENCES users     ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT;


INSERT INTO templates (name, opts, description, dt_created, dt_changed) VALUES ('Thousand', '{"sort": ["suite", "level"], "suites": "HSDC", "trump": true, "lead": {"0": "bidder", "*": "trick"}, "talon": {"face": false}, "move": {"win": {"suite": true, "level": true}, "pass": false, "cards": 1, "crawl": 0, "response": {"suite": {"trump": "optional"}}, "special": {"wheels": {"0": false, "*": [["AD", "0D"], ["AH", "0H"], ["AS", "0S"], ["AC", "0C"]], "condition": {"opt": "trump", "suite": true}}, "trump": {"0": false, "*": [["KD", "QD"], ["KH", "QH"], ["KS", "QS"], ["KC", "QC"]], "condition": {"cards": 3}}}}, "reveal": true, "hand": 7, "trick": true, "players": [3, 4], "complete": {"score": 1000}, "levels": "9JQK0A", "bidding": {"sell": true, "blind": true, "min": 60, "max": {"blind": 120, "*": 120, "trump": 340}, "distribute": true, "pass_final": true, "talon": true, "step": 5, "pass": true}, "pass": false, "cards": ["9S", "9H", "9D", "9C", "JS", "JH", "JD", "JC", "QS", "QH", "QD", "QC", "KS", "KH", "KD", "KC", "0S", "0H", "0D", "0C", "AS", "AH", "AD", "AC"], "redeal": {"reveal": true, "condition": {"min": 3, "hand": ["9H", "9S", "9D", "9C"]}}, "points": {"trick": {"A": 11, "K": 4, "J": 2, "Q": 3, "0": 10, "9": 0}, "bidonly": {"min": 900}, "bonuses": {"blind": {"value": 2, "op": "mul"}}, "penalties": {"blind": {"value": -2, "op": "mul"}, "nochange": {"op": "add", "value": -100, "times": 3}, "bid": {"value": -1, "op": "mul"}}, "special": {"wheels": 120, "trump": {"C": 100, "H": 60, "S": 80, "D": 40}}}}', E'A trick-taking game for 3-4 players, with a bidding phase and a playing phase.\nPlayed with a deck of 24 cards, from nines to aces. The goal is to be the\nfirst player who reaches 1000 points.\n\nVery engaging, highly popular in Eastern Europe. Can last for hours,\nrarely less than one hour.\n\n\n### Bidding\n\nDeck is dealt out to players (7 cards to each if 3 players, 6 cards if 4 players),\nwith the remainder going to talon face-down\n(3 cards if 3 players, 4 cards if 4 players). Players clockwise start placing\ntheir bids based on their hand: how many points will they make if they get\nthe talon. Minimum bet is 60 points, default maximum is 120 points,\nor higher if player has trump cards in hand.\n\nBidding is not mandatory, player can pass.\nPassing during bidding is final - player can bid no more.\n\nIf all players pass without bidding, deck is re-dealt.\n\nIf a player has at least 3 nines in their hand, they can demand a re-deal\non their first bid.\n\n\n#### Blind\n\nA player can bid _blind_, without looking at their hand. If they succeed\nin making that many points in game, they will get double the points. If they fail,\nthey will get double the minus points. The maximum blind bet is 120 points.\n\n\n#### Selling\n\nIf player who won the talon, sees the talon cards and thinks they will not\nsucceed in making the points they bid, they can _sell_ the talon.\nTalon cards go back on table, face-up this time, and players can continue\nbidding for the talon, starting with player next to the seller.\nPlayers who passed the first time can also participate.\nThe selling player can also participate if somebody overbids their initial\nnumber.\n\nIf another player buys the talon, the seller gets no penalty.\nIf nobody wants to buy the talon, the seller simply continues as they were,\nwith the talon back in their hand.\n\nTalon cannot be re-sold.\n\n\n### Distributing\n\nOnce a player has won the bidding, they receive the talon cards into their hand.\nThey now need to give one freely chosen card from their hand to each other player,\nso that all players have the same amount of cards.\n\nWhen playing with real cards, the player who won the talon always needs to\nremember that they have to distribute cards to other players. If they forget\nand for instance play an ace as the typical first move, face up,\nthen the next player can take that ace into their hand as a card distributed to them.\n\n\n### Playing\n\nPlayer who won the talon, leads the first trick and plays a card.\nEach player clockwise needs to play one card in response,\nsame suite if they have it, any suite otherwise.\nThe player who played the top ranking card in the leading suite,\nwins the trick and can start the next trick.\n\nPlaying a card of another suite in response loses the trick automatically,\nregardless of the card level (e.g. ace of spades does not beat a leading nine of hearts).\nUnless player plays a trump card: trump suite takes precedence over leading suite.\n\nCard ranking is: ace as highest, ten, king, queen, jack, nine as lowest.\n\nOnly the last trick taken can be looked at afterwards, while game is underway.\n\n\n#### Crawling\n\nIf the bidding player has no aces in hand, they can _crawl_ on their first move:\nplay a card face-down. Every other player plays their card face down as well,\ntrick is still won by whoever played the top card in context of the first card.\n\n\n### Trump\n\nIf player leading the trick has taken at least one trick already,\nhas at least three cards in hand, and has the king and queen of one suite in hand,\nthey can make a _trump_: play one of the two cards and declare "trump".\nFrom that moment on, this suite trumps other suites.\n\nMultiple trumps can be made during one game,\nnext trump overrides the previous one.\n\n\n#### Wheels\n\nAdditionally, if player leading the trick has the ace and ten\nof the current trump suite in hand (regardless of who made the trump),\nthey can make _wheels_: play one of the two cards and declare "wheels".\nThis will give them an additional 120 points.\n\n\n### Points\n\nWhen all hands have been played, players tally up their points. Each trick taken\ngives them points from the cards in trick:\n\n- ace:  11 points\n- ten:  10 points\n- king:  4 points\n- queen: 3 points\n- jack:  2 points\n- nine:  0 points\n\nThe total tally from all cards is 120 points.\n\nEach trump that a player makes gives them points according to the suite:\n\n- clubs:   100 points\n- spades:   80 points\n- hearts:   60 points\n- diamonds: 40 points\n\nWheels give player 120 points.\n\nThe player who won the talon, gets the exact amount bid if they succeed in making\nat least that many points. Making more does not give them more points.\nIf the player fails at making as many points they bid, they will get minus the amount.\n\nOther players will get as many points as their tricks and trumps etc give them.\n\nIf a player\'s point score has not changed for three games in a row, they will lose\n100 points. Points can go below zero without limit.\n\nWhile a player has a score of 900 points or higher, they can only receive more points\nif they bid and succeed in meeting their bid; they will get no points otherwise,\nregardless of how many tricks and trumps they take and make.', '2020-04-18 22:07:23.000000+00:00', '2020-05-03 18:01:29.635000+00:00');

INSERT INTO templates (name, opts, description, dt_created, dt_changed) VALUES ('Arschloch', '{"sort": "level", "suites": "HSDCX", "lead": {"0": {"ranking": -1}, "*": "trick"}, "discards": true, "move": {"cards": "*", "win": {"last": true, "level": "all"}, "pass": true, "response": {"amount": true, "level": true}, "level": true}, "hand": 19, "order": true, "players": [3, 7], "ranking": {"finish": true}, "nextgame": {"distribute": {"ranking": true, "max": 3}}, "cards": ["3S", "3H", "3D", "3C", "4S", "4H", "4D", "4C", "5S", "5H", "5D", "5C", "6S", "6H", "6D", "6C", "7S", "7H", "7D", "7C", "8S", "8H", "8D", "8C", "9S", "9H", "9D", "9C", "0S", "0H", "0D", "0C", "JS", "JH", "JD", "JC", "QS", "QH", "QD", "QC", "KS", "KH", "KD", "KC", "AS", "AH", "AD", "AC", "2S", "2H", "2D", "2C", "XX", "YX", "ZX"], "levels": "34567890JQKA2X", "reveal": false}', E'A game for 3-7 players, with winners and losers exchanging cards in consecutive games.\nPlayed with a full deck of 55 cards, all cards from twos to aces to jokers. In each\ngame set, the goal is to empty own hand first; player finishing first is the\nwinner and player finishing last the loser.\n\n4-5 players makes for optimum gameplay.\n\nSimple rules, highly addictive and engaging. Game series can last for hours,\nor be had as a quick entertainment during a break.\n\nKnown by many other names: Asshole, Capitalism, President, Scum.\n\n\n### Playing\n\nEntire deck is dealt out to all players (inevitably unevenly, unless there\nare exactly 5 players). In first game in series, the player next to dealer\nleads the first trick, in following games the loser of the previous game\nleads the first trick.\n\nPlayer leads a trick by playing a single or pair or triple or quadruple\nof a kind, e.g. 3 nines. Next players clockwise need to play their cards\nsimilarly all of one level, at least the same amount of cards,\nat least the same level. Suites are irrelevant.\nPlayer can pass; once passed, they can play no more during this trick.\n\nIf all players have passed except the one who played last,\nthe trick is discarded and the last player can lead the next trick.\n\nIf all cards of one level meet in one trick (four of a kind or three jokers),\nthe trick is discarded and the last player can lead the next trick.\n\nCard ranking is: joker as highest, two, ace, king, queen, jack, ten, nine,\n.., four, three as lowest.\n\nOnly the last trick discarded can be looked at afterwards, while game is underway.\n\n\n### Exchanging\n\nIn consecutive games, the high and low ranking players of the previous game\nexchange cards among themselves, with low ranks needing to give their top cards\nand high ranks able to give any cards they choose. First and last player\nexchange 3 cards, further ranks exchange one card less per step. With at least\n4 players, second best and second last exchange 2 cards. With at least 6 players,\nthird best and third last exchange 1 card.\n\nWith an odd number players, the player at exact middle rank exchanges with no one.\n\nWhen playing with real cards, the loser needs to deal.\n\n\n### Comment\n\nAs such, the top-ranking players continue to dominate following games,\nsince they can not only give away low cards, but focus on getting rid of\nsingles - in addition to receiving high cards back. Oftentimes\nthe first half of the game is the top ranks fighting each other until they finish,\nas the losing players simply don\'t have as many high cards and multiples to play.\n\nThe only advantages for the losing player are: they can lead the first trick,\nand depending on the number of players they tend to get one card less.\n\nWho exactly is the Arschloch here - the winner or the loser - is matter of debate.', '2020-05-03 19:46:23.843000+00:00', '2020-05-08 21:10:13.930000+00:00');

INSERT INTO templates (name, opts, description, dt_created, dt_changed) VALUES ('Five Sheets', '{"sort": ["suite", "level"], "suites": "HSDC", "trump": true, "ranking": {"finish": true}, "talon": {"trump": true, "lead": true, "face": false}, "move": {"cards": 1, "follow": {"cards": 1}, "response": {"suite": {"trump": "alternative"}, "level": true}, "retreat": {"uptake": {"stack": 5}}}, "hand": 5, "players": [2, 8], "levels": "2345678909JQKA", "cards": ["2H", "2S", "2D", "2C", "3H", "3S", "3D", "3C", "4H", "4S", "4D", "4C", "5H", "5S", "5D", "5C", "6H", "6S", "6D", "6C", "7H", "7S", "7D", "7C", "8H", "8S", "8D", "8C", "9H", "9S", "9D", "9C", "0H", "0S", "0D", "0C", "JH", "JS", "JD", "JC", "QH", "QS", "QD", "QC", "KH", "KS", "KD", "KC", "AH", "AS", "AD", "AC"], "refill": true, "stack": true}', E'A simple game for 2-8 players, with players needing to kill the previous\ncard and play a card for the next player to kill. Played with a deck of 52\ncards, from twos to aces. The goal is to empty own hand first; player finishing\nfirst is the winner and player finishing last the loser.\n\n\n### Playing\n\nEach player is dealt 5 cards, the remainder going to talon face-down, with\none card below talon face-up as the trump, and one card in table stack face-up\nas the lead.\n\nPlayer next to the dealer leads by playing a card to stack that kills the last\ncard in stack, and follows it with another card for the next player to kill.\nA card can be killed by a higher card in same suite, or a card in trump suite.\nTrump can be played even if player has higher cards in same suite.\n\nAfter making their move, player refills their hand by taking new cards from\ntalon until they have 5 in hand. The face-up trump card below talon gets taken\nup last.\n\nIf player cannot or chooses not to kill the last card in stack, they need to\nretreat by taking up to 5 cards from stack into hand. If stack gets emptied\nduring a retreat, a new card is played from talon to stack. If both stack and\ntalon are empty, the next player only needs to play a single card.\n\nIf player has a single card in hand, they do not need to play the follow card.\n\nCard ranking is: ace as highest, king, queen, jack, ten, .., three, two as lowest.', '2020-05-20 09:49:39.140000+00:00', '2020-05-21 18:54:00.256000+00:00');


CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON games     FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON online    FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON players   FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON tables    FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON requests  FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON templates FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON users     FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
