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
  i18n        JSONB     NOT NULL DEFAULT '{}',
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


INSERT INTO templates (name, opts, description, i18n, dt_created, dt_changed) VALUES ('Thousand', '{"sort": ["suite", "level"], "suites": "HSDC", "trump": true, "lead": {"0": "bidder", "*": "trick"}, "talon": {"face": false}, "move": {"win": {"suite": true, "level": true}, "pass": false, "cards": 1, "crawl": 0, "response": {"suite": {"trump": "optional"}}, "special": {"wheels": {"0": false, "*": [["AD", "0D"], ["AH", "0H"], ["AS", "0S"], ["AC", "0C"]], "condition": {"opt": "trump", "suite": true}}, "trump": {"0": false, "*": [["KD", "QD"], ["KH", "QH"], ["KS", "QS"], ["KC", "QC"]], "condition": {"cards": 3}}}}, "reveal": true, "hand": 7, "trick": true, "players": [3, 4], "complete": {"score": 1000}, "levels": "9JQK0A", "bidding": {"sell": true, "blind": true, "min": 60, "max": {"blind": 120, "*": 120, "trump": 340}, "distribute": true, "pass_final": true, "talon": true, "step": 5, "pass": true}, "pass": false, "cards": ["9S", "9H", "9D", "9C", "JS", "JH", "JD", "JC", "QS", "QH", "QD", "QC", "KS", "KH", "KD", "KC", "0S", "0H", "0D", "0C", "AS", "AH", "AD", "AC"], "redeal": {"reveal": true, "condition": {"min": 3, "hand": ["9H", "9S", "9D", "9C"]}}, "points": {"trick": {"A": 11, "K": 4, "J": 2, "Q": 3, "0": 10, "9": 0}, "bidonly": {"min": 900}, "bonuses": {"blind": {"value": 2, "op": "mul"}}, "penalties": {"blind": {"value": -2, "op": "mul"}, "nochange": {"op": "add", "value": -100, "times": 3}, "bid": {"value": -1, "op": "mul"}}, "special": {"wheels": 120, "trump": {"C": 100, "H": 60, "S": 80, "D": 40}}}}', E'A trick-taking game for 3-4 players, with a bidding phase and a playing phase.\nPlayed with a deck of 24 cards, from nines to aces. The goal is to be the\nfirst player who reaches 1000 points.\n\nVery engaging, highly popular in Eastern Europe. Can last for hours,\nrarely less than one hour.\n\n\n### Bidding\n\nDeck is dealt out to players (7 cards to each if 3 players, 6 cards if 4 players),\nwith the remainder going to talon face-down\n(3 cards if 3 players, 4 cards if 4 players). Players clockwise start placing\ntheir bids based on their hand: how many points will they make if they get\nthe talon. Minimum bet is 60 points, default maximum is 120 points,\nor higher if player has trump cards in hand.\n\nBidding is not mandatory, player can pass.\nPassing during bidding is final - player can bid no more.\n\nIf all players pass without bidding, deck is re-dealt.\n\nIf a player has at least 3 nines in their hand, they can demand a re-deal\non their first bid.\n\n\n#### Blind\n\nA player can bid _blind_, without looking at their hand. If they succeed\nin making that many points in game, they will get double the points. If they fail,\nthey will get double the minus points. The maximum blind bet is 120 points.\n\n\n#### Selling\n\nIf player who won the talon, sees the talon cards and thinks they will not\nsucceed in making the points they bid, they can _sell_ the talon.\nTalon cards go back on table, face-up this time, and players can continue\nbidding for the talon, starting with player next to the seller.\nPlayers who passed the first time can also participate.\nThe selling player can also participate if somebody overbids their initial\nnumber.\n\nIf another player buys the talon, the seller gets no penalty.\nIf nobody wants to buy the talon, the seller simply continues as they were,\nwith the talon back in their hand.\n\nTalon cannot be re-sold.\n\n\n### Distributing\n\nOnce a player has won the bidding, they receive the talon cards into their hand.\nThey now need to give one freely chosen card from their hand to each other player,\nso that all players have the same amount of cards.\n\nWhen playing with real cards, the player who won the talon always needs to\nremember that they have to distribute cards to other players. If they forget\nand for instance play an ace as the typical first move, face up,\nthen the next player can take that ace into their hand as a card distributed to them.\n\n\n### Playing\n\nPlayer who won the talon, leads the first trick and plays a card.\nEach player clockwise needs to play one card in response,\nsame suite if they have it, any suite otherwise.\nThe player who played the top ranking card in the leading suite,\nwins the trick and can start the next trick.\n\nPlaying a card of another suite in response loses the trick automatically,\nregardless of the card level (e.g. ace of spades does not beat a leading nine of hearts).\nUnless player plays a trump card: trump suite takes precedence over leading suite.\n\nCard ranking is: ace as highest, ten, king, queen, jack, nine as lowest.\n\nOnly the last trick taken can be looked at afterwards, while game is underway.\n\n\n#### Crawling\n\nIf the bidding player has no aces in hand, they can _crawl_ on their first move:\nplay a card face-down. Every other player plays their card face down as well,\ntrick is still won by whoever played the top card in context of the first card.\n\n\n### Trump\n\nIf player leading the trick has taken at least one trick already,\nhas at least three cards in hand, and has the king and queen of one suite in hand,\nthey can make a _trump_: play one of the two cards and declare "trump".\nFrom that moment on, this suite trumps other suites.\n\nMultiple trumps can be made during one game,\nnext trump overrides the previous one.\n\n\n#### Wheels\n\nAdditionally, if player leading the trick has the ace and ten\nof the current trump suite in hand (regardless of who made the trump),\nthey can make _wheels_: play one of the two cards and declare "wheels".\nThis will give them an additional 120 points.\n\n\n### Points\n\nWhen all hands have been played, players tally up their points. Each trick taken\ngives them points from the cards in trick:\n\n- ace:  11 points\n- ten:  10 points\n- king:  4 points\n- queen: 3 points\n- jack:  2 points\n- nine:  0 points\n\nThe total tally from all cards is 120 points.\n\nEach trump that a player makes gives them points according to the suite:\n\n- clubs:   100 points\n- spades:   80 points\n- hearts:   60 points\n- diamonds: 40 points\n\nWheels give player 120 points.\n\nThe player who won the talon, gets the exact amount bid if they succeed in making\nat least that many points. Making more does not give them more points.\nIf the player fails at making as many points they bid, they will get minus the amount.\n\nOther players will get as many points as their tricks and trumps etc give them.\n\nIf a player\'s point score has not changed for three games in a row, they will lose\n100 points. Points can go below zero without limit.\n\nWhile a player has a score of 900 points or higher, they can only receive more points\nif they bid and succeed in meeting their bid; they will get no points otherwise,\nregardless of how many tricks and trumps they take and make.', '{"et": {"template.name": "Tuhat", "wheels": "rattad", "template.description": "Tihide v\u00f5tmise m\u00e4ng 3-4 m\u00e4ngijale, pakkumise ja v\u00e4ljak\u00e4imisega.\nM\u00e4ngitakse pakiga, kus on 24 kaarti, \u00fcheksad kuni \u00e4ssad. Eesm\u00e4rgiks on j\u00f5uda\nesimesena 1000 punktini.\n\nKaasakiskuv m\u00e4ng, populaarne Eestis ja mujal Ida-Euroopas.\nV\u00f5ib kesta tunde, harva alla tunni.\n\n\n### Pakkumine\n\nKaardid jagatakse m\u00e4ngijatele v\u00e4lja (7 kaarti igale kui 3 m\u00e4ngijat, 6 kaarti\nkui 4 m\u00e4ngijat), \u00fclej\u00e4\u00e4nud l\u00e4hevad laua keskele, pilt allapoole\n(3 kaarti kui 3 m\u00e4ngijat, 4 kaarti kui 4 m\u00e4ngijat). M\u00e4ngijad hakkavad ringiratast\npakkuma oma kaartide p\u00f5hjal: palju punkte nad v\u00f5idaksid kui nad saavad laual\nolevad lisakaardid endale. Madalaim pakkumine on 60 punkti, k\u00f5rgeim vaikimisi 120,\nrohkem saab pakkuda ainult siis kui m\u00e4ngijal on trump k\u00e4es.\n\nPakkuma ei pea, m\u00e4ngija v\u00f5ib passida.\nPassimine on l\u00f5plik - hiljem vahele pakkuda m\u00e4ngija ei saa.\n\nKui k\u00f5ik m\u00e4ngijad passivad, tehakse uued kaardid.\n\nKui m\u00e4ngijal on k\u00e4es v\u00e4hemalt 3 \u00fcheksat, v\u00f5ib ta oma esimesel pakkumisel\nn\u00f5uda uusi kaarte.\n\n\n#### Pime\n\nM\u00e4ngija v\u00f5ib teha _pime_ pakkumise, kui nad ei ole oma k\u00e4es olevaid kaarte vaadanud.\nKui neil \u00f5nnestub pakutud punktid t\u00e4is saada, v\u00f5idavad nad topelt nii palju.\nKui neil ei \u00f5nnestu punkte t\u00e4is saada, kaotavad nad topelt sama palju.\nSuurim lubatud pimepakkumine on 120 punkti.\n\n\n#### M\u00fc\u00fcmine\n\nKui pakkumise v\u00f5itnud m\u00e4ngija n\u00e4eb lisakaarte ja leiab, et tal ei \u00f5nnestu punkte\nt\u00e4is saada, v\u00f5ib ta lisakaardid \u00e4ra _m\u00fc\u00fca_. Lisakaardid l\u00e4hevad laua keskele\ntagasi, seekord pilt \u00fclespoole, ja m\u00e4ngijad saavad j\u00e4tkata pakkumist,\nalustades m\u00fc\u00fcjale j\u00e4rgmisest m\u00e4ngijast. M\u00e4ngijad, kes esimene kord passisid,\nv\u00f5ivad pakkumises osaleda. Ka m\u00fc\u00fcja v\u00f5ib pakkumises osaleda, kui keegi tema\nesimese pakkumise on \u00fcle pakkunud.\n\nKui teine m\u00e4ngija ostab lisakaardid \u00e4ra, ei saa m\u00fc\u00fcja mingit karistust.\nKui keegi ei soovi osta, siis m\u00fc\u00fcja lihtsalt j\u00e4tkab m\u00e4ngu, lisakaardid k\u00e4es.\n\nKaarte teist korda m\u00fc\u00fca ei saa.\n\n\n### Jagamine\n\nPakkumise v\u00f5itnud m\u00e4ngija saab lisakaardid endale k\u00e4tte. N\u00fc\u00fcd ta peab andma \u00fche\nvabalt valitud kaardi igale m\u00e4ngijale, nii et k\u00f5igil on v\u00f5rdselt kaarte k\u00e4es.\n\nP\u00e4ris kaartidega m\u00e4ngimisel peab pakkumise v\u00f5itnud m\u00e4ngija alati meeles pidama,\net tal on vaja teistele m\u00e4ngijatele kaarte jagada. Kui tal see meelest l\u00e4heb\nja ta n\u00e4iteks \u00e4ssa v\u00e4lja k\u00e4ib kui tavalise esimese k\u00e4igu, pilt \u00fclespoole,\nsiis temast j\u00e4rgmine m\u00e4ngija v\u00f5ib selle \u00e4ssa endale v\u00f5tta kui talle jagatud kaardi.\n\n\n### M\u00e4ngimine\n\nPakkumise v\u00f5itnud m\u00e4ngija alustab ringi ja k\u00e4ib \u00fche kaardi. Iga m\u00e4ngija ringiratast\npeab k\u00e4ima \u00fche kaardi vastu, sama masti kui neil on, \u00fcksk\u00f5ik mida muud kui pole.\nTihi v\u00f5idab m\u00e4ngija, kes k\u00e4is esimeses mastis k\u00f5ige tugevama kaardi, ja ta saab\nalustada uut ringi.\n\nTeisest mastist kaardi k\u00e4imine kaotab tihi, hoolimata kaardi tugevusest\n(nt poti \u00e4ss ei v\u00f5ida \u00e4rtu \u00fcheksat). V\u00e4lja arvatud siis kui m\u00e4ngija k\u00e4ib\ntrumpi: trumbimast v\u00f5idab teisi maste.\n\nKaartide tugevus on: \u00e4ss tugevaim, k\u00fcmme, kuningas, emand, poiss, \u00fcheksa n\u00f5rgeim.\n\nM\u00e4ngu ajal saab uuesti vaadata ainult viimase tihi kaarte.\n\n\n#### Roomamine\n\nKui pakkumise v\u00f5itnud m\u00e4ngijal ei ole \u00fchtegi \u00e4ssa, v\u00f5ivad nad oma esimesel\nk\u00e4igul _roomata_: k\u00e4ivad kaardi v\u00e4lja, pilt allapoole. Teised m\u00e4ngijad\nk\u00e4ivad oma kaardi samuti pilt allapoole, tihi v\u00f5idab ikkagi see m\u00e4ngija,\nkes k\u00e4is esimeses mastis k\u00f5ige tugevama kaardi.\n\n\n### Trump\n\nKui ringi alustav m\u00e4ngija on juba \u00fche tihi v\u00f5tnud, neil on v\u00e4hemalt kolm kaarti\nveel k\u00e4es, ja neil on k\u00e4es \u00fchest mastist kuningas ja emand, saavad nad teha\n_trumpi_: k\u00e4ivad \u00fche nendest kahest kaardist ja \u00fctlevad \"trump\".\nSellest hetkest on see mast trumbimast, teistest mastidest tugevam.\n\n\u00dche m\u00e4ngu jooksul saab teha mitu trumpi, j\u00e4rgmine trump kustutab eelmise.\n\n#### Rattad\n\nLisaks, kui ringi alustaval m\u00e4ngijal on k\u00e4es trumbimasti \u00e4ss ja k\u00fcmme,\nsaavad nad teha _rattad_: k\u00e4ivad \u00fche nendest kahest kaardist ja \u00fctlevad \"rattad\".\nSee annab neile lisa 120 punkti.\n\n\n### Punktid\n\nKui k\u00f5ik kaardid on k\u00e4idud, loetakse punktid kokku. Iga v\u00f5etud tihi\nannab m\u00e4ngijale punkte tihis saadud kaartide eest:\n\n- \u00e4ss:      11 punkti\n- k\u00fcmme:    10 punkti\n- kuningas:  4 punkti\n- emand:     3 punkti\n- poiss:     2 punkti\n- \u00fcheksa:    0 punkti\n\nK\u00f5ik kaardid kokku annavad 120 punkti.\n\nIga tehtud trump annab m\u00e4ngijale punkte s\u00f5ltuvalt mastist:\n\n- risti:  100 punkti\n- poti:    80 punkti\n- \u00e4rtu:    60 punkti\n- ruutu:   40 punkti\n\nRattad annavad m\u00e4ngijale 120 punkti.\n\nPakkumise v\u00f5itnud m\u00e4ngija saab t\u00e4pselt pakkumises \u00f6eldud punktid, kui nad v\u00e4hemalt\nnii palju punkte kokku saavad. Lisapunktid \u00fcle pakkumise ei anna neile rohkem midagi.\nKui pakkumise v\u00f5itnud m\u00e4ngija ei suuda pakutud punkte kokku saada, kaotavad nad\npunkte pakutud numbri v\u00f5rra.\n\nPimepakkumine kahekordistab nii v\u00f5idu kui kaotuse.\n\nTeised m\u00e4ngijad saavad punkte nii, nagu nende tihid ja trumbid jne neile annavad.\n\nKui m\u00e4ngija punktid pole kolm m\u00e4ngu j\u00e4rjest muutunud, kaotab m\u00e4ngija 100 punkti.\nPunktid v\u00f5ivad minna alla nulli, ilma alumise piirita.\n\nKui m\u00e4ngijal on 900 punkti v\u00f5i rohkem, saavad nad punkte juurde teenida ainult\npakkumist v\u00f5ites ja pakutud punkte t\u00e4is saades. Teise m\u00e4ngija pakutud m\u00e4ngus\nei saa nad \u00fchtegi punkti, hoolimata sellest mitu tihi ja trumpi nad v\u00f5tavad\nja teevad."}}', '2020-04-18 22:07:23.000000+00:00', '2020-05-03 18:01:29.635000+00:00');

INSERT INTO templates (name, opts, description, i18n, dt_created, dt_changed) VALUES ('Arschloch', '{"sort": "level", "suites": "HSDCX", "lead": {"0": {"ranking": -1}, "*": "trick"}, "discards": true, "move": {"cards": "*", "win": {"last": true, "level": "all"}, "pass": true, "response": {"amount": true, "level": true}, "level": true}, "hand": 19, "order": true, "players": [3, 7], "ranking": {"finish": true}, "nextgame": {"distribute": {"ranking": true, "max": 3}}, "cards": ["3S", "3H", "3D", "3C", "4S", "4H", "4D", "4C", "5S", "5H", "5D", "5C", "6S", "6H", "6D", "6C", "7S", "7H", "7D", "7C", "8S", "8H", "8D", "8C", "9S", "9H", "9D", "9C", "0S", "0H", "0D", "0C", "JS", "JH", "JD", "JC", "QS", "QH", "QD", "QC", "KS", "KH", "KD", "KC", "AS", "AH", "AD", "AC", "2S", "2H", "2D", "2C", "XX", "YX", "ZX"], "levels": "34567890JQKA2X", "reveal": false}', E'A game for 3-7 players, with winners and losers exchanging cards in consecutive games.\nPlayed with a full deck of 55 cards, all cards from twos to aces to jokers. In each\ngame set, the goal is to empty own hand first; player finishing first is the\nwinner and player finishing last the loser.\n\n4-5 players makes for optimum gameplay.\n\nSimple rules, highly addictive and engaging. Game series can last for hours,\nor be had as a quick entertainment during a break.\n\nKnown by many other names: Asshole, Capitalism, President, Scum.\n\n\n### Playing\n\nEntire deck is dealt out to all players (inevitably unevenly, unless there\nare exactly 5 players). In first game in series, the player next to dealer\nleads the first trick, in following games the loser of the previous game\nleads the first trick.\n\nPlayer leads a trick by playing a single or pair or triple or quadruple\nof a kind, e.g. 3 nines. Next players clockwise need to play their cards\nsimilarly all of one level, at least the same amount of cards,\nat least the same level. Suites are irrelevant.\nPlayer can pass; once passed, they can play no more during this trick.\n\nIf all players have passed except the one who played last,\nthe trick is discarded and the last player can lead the next trick.\n\nIf all cards of one level meet in one trick (four of a kind or three jokers),\nthe trick is discarded and the last player can lead the next trick.\n\nCard ranking is: joker as highest, two, ace, king, queen, jack, ten, nine,\n.., four, three as lowest.\n\nOnly the last trick discarded can be looked at afterwards, while game is underway.\n\n\n### Exchanging\n\nIn consecutive games, the high and low ranking players of the previous game\nexchange cards among themselves, with low ranks needing to give their top cards\nand high ranks able to give any cards they choose. First and last player\nexchange 3 cards, further ranks exchange one card less per step. With at least\n4 players, second best and second last exchange 2 cards. With at least 6 players,\nthird best and third last exchange 1 card.\n\nWith an odd number players, the player at exact middle rank exchanges with no one.\n\nWhen playing with real cards, the loser needs to deal.\n\n\n### Comment\n\nAs such, the top-ranking players continue to dominate following games,\nsince they can not only give away low cards, but focus on getting rid of\nsingles - in addition to receiving high cards back. Oftentimes\nthe first half of the game is the top ranks fighting each other until they finish,\nas the losing players simply don\'t have as many high cards and multiples to play.\n\nThe only advantages for the losing player are: they can lead the first trick,\nand depending on the number of players they tend to get one card less.\n\nWho exactly is the Arschloch here - the winner or the loser - is matter of debate.', '{"et": {"template.description": "\nM\u00e4ng 3-7 m\u00e4ngijale, kus v\u00f5itjad ja kaotajad vahetavad omavahel kaarte j\u00e4rgmistes\nm\u00e4ngudes. M\u00e4ngitakse t\u00e4ispakiga, 55 kaarti, k\u00f5ik alates kahtedest kuni \u00e4ssade\nkuni jokkeriteni. Igas m\u00e4ngus on eesm\u00e4rgiks oma kaartidest k\u00f5ige varem vabaneda;\nesimesena kaartidest lahtisaanu on v\u00f5itja ja viimasena lahtisaanu on kaotaja.\n\nParim m\u00e4ngu kulgemine on 4-5 m\u00e4ngijaga.\n\nLihtsad reeglid, kaasakiskuv ja s\u00f5ltuvusttekitav. M\u00e4ng v\u00f5ib kesta tunde,\naga sobib ka kiireks meelelahutuseks millegi vahepeal.\n\nMaailmas tuntud paljude nimede all: Asshole, Capitalism, President, Scum.\n\n\n### M\u00e4ngimine\n\nK\u00f5ik kaardid jagatakse m\u00e4ngijate vahel v\u00e4lja (paratamatult ei jagu t\u00e4pselt,\nv\u00e4lja arvatud 5 m\u00e4ngija puhul). Esimeses m\u00e4ngus alustab jagajast j\u00e4rgmine,\nj\u00e4rgmistes m\u00e4ngudes alustab eelmise m\u00e4ngu kaotaja.\n\nM\u00e4ngija alustab ringi, k\u00e4ies v\u00e4lja \u00fcksiku v\u00f5i paari v\u00f5i kolmiku v\u00f5i neliku,\nnt 3 \u00fcheksat. J\u00e4rgmised m\u00e4ngijad ringiratast peavad sinna peale k\u00e4ima\nv\u00e4hemalt sama palju kaarte, v\u00e4hemalt sama tugevaid, ka k\u00f5ik \u00fche k\u00f5rgusega.\nKaardimastid ei loe. M\u00e4ngija v\u00f5ib passida; passides see ring rohkem k\u00e4ia ei saa.\n\nKui k\u00f5ik m\u00e4ngijad peale viimasena m\u00e4nginu on passinud, l\u00e4hevad kaardid maha\nja viimane m\u00e4ngija saab alustada j\u00e4rgmist ringi.\n\nKui laual tulevad kokku \u00fche k\u00f5rguse k\u00f5ik kaardid (neli tavakaarti v\u00f5i kolm jokkerit),\nl\u00e4hevad kaardid maha ja viimane m\u00e4ngija saab alustada j\u00e4rgmist ringi.\n\nKaartide tugevus on: jokker tugevaim, kaks, \u00e4ss, kuningas, emand, poiss, k\u00fcmme,\n\u00fcheksa, .., neli, kolm n\u00f5rgeim.\n\nM\u00e4ngu ajal saab uuesti vaadata ainult viimasena mahal\u00e4inud ringi kaarte.\n\n\n### Vahetamine\n\nJ\u00e4rgmistes m\u00e4ngudes vahetavad eelmise m\u00e4ngu v\u00f5itjad ja kaotajad omavahel kaarte,\nkaotajad peavad \u00e4ra andma oma k\u00f5ige tugevamad kaardid ja v\u00f5itjad saavad \u00e4ra\nanda vabalt valitud kaarte. Esimene ja viimane m\u00e4ngija vahetavad 3 kaarti,\nj\u00e4rgmised kohad vahetavad sammu v\u00f5rra v\u00e4hem. Seega v\u00e4hemalt 4 m\u00e4ngija puhul vahetavad\neest ja tagant teine omavahel 2 kaarti, v\u00e4hemalt 6 m\u00e4ngija puhul vahetavad\neest ja tagant kolmas omavahel 1 kaardi.\n\nKui on paaritu arv m\u00e4ngijaid, siis pingereas t\u00e4pselt keskmine ei vaheta kellegagi.\n\nP\u00e4ris kaartidega m\u00e4ngides peab kaotaja uued kaardid tegema.\n\n\n### Kommentaar\n\nVahetamise t\u00f5ttu kipub pingerea ladvik v\u00f5itma ka j\u00e4rgmistes m\u00e4ngudes, sest nad\nmitte ainult ei saa oma n\u00f5rkasid kaarte \u00e4ra anda, nad saavad ka keskenduda \u00fcksikute\nkaartide \u00e4raandmisele - ja lisaks nad saavad veel h\u00e4id kaarte vastu. Tihtipeale\nm\u00e4ngu alguses s\u00f5divad esimene-teine koht omavahel kuni kaartidest lahti saavad,\nkuna kaotanud m\u00e4ngijatel lihtsalt pole nii k\u00f5rgeid kaarte ja nii palju mitmikuid k\u00e4ia.\n\nViimasel kohal oleva m\u00e4ngija ainsad eelised on: ta saab alustada esimest ringi,\nja s\u00f5ltuvalt m\u00e4ngijate arvust jagub talle enamasti kaarte \u00fche v\u00f5rra v\u00e4hem.\n\nKes t\u00e4pselt on siin m\u00e4ngus Arschloch - esimene v\u00f5i viimane koht - on vaieldav."}}', '2020-05-03 19:46:23.843000+00:00', '2020-05-08 21:10:13.930000+00:00');

INSERT INTO templates (name, opts, description, i18n, dt_created, dt_changed) VALUES ('Five Sheets', '{"sort": ["suite", "level"], "suites": "HSDC", "trump": true, "ranking": {"finish": true}, "talon": {"trump": true, "lead": true, "face": false}, "move": {"cards": 1, "follow": {"cards": 1}, "response": {"suite": {"trump": "alternative"}, "level": true}, "retreat": {"uptake": {"stack": 5}}}, "hand": 5, "players": [2, 8], "levels": "2345678909JQKA", "cards": ["2H", "2S", "2D", "2C", "3H", "3S", "3D", "3C", "4H", "4S", "4D", "4C", "5H", "5S", "5D", "5C", "6H", "6S", "6D", "6C", "7H", "7S", "7D", "7C", "8H", "8S", "8D", "8C", "9H", "9S", "9D", "9C", "0H", "0S", "0D", "0C", "JH", "JS", "JD", "JC", "QH", "QS", "QD", "QC", "KH", "KS", "KD", "KC", "AH", "AS", "AD", "AC"], "refill": true, "stack": true}', E'A simple game for 2-8 players, with players needing to kill the previous\ncard and play a card for the next player to kill. Played with a deck of 52\ncards, from twos to aces. The goal is to empty own hand first; player finishing\nfirst is the winner and player finishing last the loser.\n\n\n### Playing\n\nEach player is dealt 5 cards, the remainder going to talon face-down, with\none card below talon face-up as the trump, and one card in table stack face-up\nas the lead.\n\nPlayer next to the dealer leads by playing a card to stack that kills the last\ncard in stack, and follows it with another card for the next player to kill.\nA card can be killed by a higher card in same suite, or a card in trump suite.\nTrump can be played even if player has higher cards in same suite.\n\nAfter making their move, player refills their hand by taking new cards from\ntalon until they have 5 in hand. The face-up trump card below talon gets taken\nup last.\n\nIf player cannot or chooses not to kill the last card in stack, they need to\nretreat by taking up to 5 cards from stack into hand. If stack gets emptied\nduring a retreat, a new card is played from talon to stack. If both stack and\ntalon are empty, the next player only needs to play a single card.\n\nIf player has a single card in hand, they do not need to play the follow card.\n\nCard ranking is: ace as highest, king, queen, jack, ten, .., three, two as lowest.', '{"et": {"template.name": "Viis lehte", "template.description": "Lihtne m\u00e4ng 2-8 m\u00e4ngijale, kus m\u00e4ngijad peavad tapma eelmise kaardi ja k\u00e4ima\nkaardi j\u00e4rgmisele m\u00e4ngijale tapmiseks. M\u00e4ngitakse pakiga, kus on 52 kaarti,\nkahed kuni \u00e4ssad. Eesm\u00e4rgiks on oma kaartidest k\u00f5ige varem vabaneda;\nesimesena kaartidest lahtisaanu on v\u00f5itja ja viimasena lahtisaanu on kaotaja.\n\n\n### M\u00e4ngimine\n\nIgale m\u00e4ngijale jagatakse 5 kaarti, \u00fclej\u00e4\u00e4nud pakk l\u00e4heb laua keskele, pilt\nallapoole, \u00fcks kaart pannakse paki alla trumbiks, pilt \u00fclespoole,\nja \u00fcks kaart k\u00e4iakse v\u00e4lja laua keskele virna alguskaardina.\n\nJagajast j\u00e4rgmine alustab, k\u00e4ies \u00fche kaardi mis tapab laua viimase kaardi,\nja veel \u00fche kaardi j\u00e4rgmisele m\u00e4ngijale tapmiseks. Kaardi tapmiseks tuleb k\u00e4ia\ntugevam kaart samas mastis, v\u00f5i trumpkaart. Trumpi saab m\u00e4ngida ka siis kui\nm\u00e4ngijal on k\u00e4ia samas mastis tugevamat.\n\nP\u00e4rast k\u00e4imist v\u00f5tab m\u00e4ngija oma kaardid laua pakist j\u00e4lle t\u00e4is, et neil oleks\n5 kaarti k\u00e4es. Paki all olev trumpkaart v\u00f5etakse viimasena.\n\nKui m\u00e4ngija ei suuda v\u00f5i ei soovi laua viimast kaarti tappa, peab ta laua\nvirnast kuni 5 kaarti \u00fcles v\u00f5tma. Kui laua virn t\u00fchjaks saab, k\u00e4iakse pakist\n\u00fcks kaart v\u00e4lja virna. Kui nii laua virn kui pakk t\u00fchjaks saavad, peab j\u00e4rgmine\nm\u00e4ngija k\u00e4ima ainult \u00fche kaardi.\n\nKui m\u00e4ngijal on ainult \u00fcks kaart k\u00e4es, ei pea nad teist kaarti k\u00e4ima.\n\nKaartide tugevus on: \u00e4ss tugevaim, kuningas, emand, poiss, k\u00fcmme, .., kolm,\nkaks n\u00f5rgeim."}}', '2020-05-20 09:49:39.140000+00:00', '2020-05-21 18:54:00.256000+00:00');


CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON games     FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON online    FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON players   FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON tables    FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON requests  FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON templates FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON users     FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
