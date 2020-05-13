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
  PRIMARY KEY (id),
  UNIQUE (fk_user, fk_table)
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
  shortid        TEXT      NOT NULL UNIQUE,
  public         BOOLEAN   NOT NULL DEFAULT FALSE,
  opts           JSONB     NOT NULL DEFAULT '{}',
  games          BIGINT    NOT NULL DEFAULT 0,
  players        BIGINT    NOT NULL DEFAULT 0,
  status         TEXT      DEFAULT 'new',
  bids           JSONB     NOT NULL DEFAULT '[]',
  scores         JSONB     NOT NULL DEFAULT '[]',
  bids_history   JSONB     NOT NULL DEFAULT '[]',
  scores_history JSONB     NOT NULL DEFAULT '[]',
  dt_created     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_changed     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);


CREATE TABLE templates (
  id         BIGSERIAL,
  fk_creator BIGINT,
  name       TEXT      NOT NULL UNIQUE CHECK (LENGTH(name) > 0),
  opts       JSONB     NOT NULL DEFAULT '{}',
  dt_created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_changed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_deleted TIMESTAMP WITH TIME ZONE,
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


INSERT INTO users (id, username, password) VALUES (nextval('users_id_seq'), 'admin', '0fb57789d87a97f7949ab902b3f2d8001acb6ddea7b4fc0b46a4681124245f4e');

INSERT INTO templates (fk_creator, name, opts, dt_created, dt_changed) VALUES (1, 'Tuhat', '{"sort": ["suite", "strength"], "suites": "DHSC", "redeal": {"reveal": true}, "trump": true, "lead": {"0": "bidder", "*": "trick"}, "talon": {"face": false}, "move": {"win": {"suite": true, "level": true}, "pass": false, "cards": 1, "crawl": 0, "response": {"suite": true}, "special": {"wheels": {"0": false, "*": [["AD", "0D"], ["AH", "0H"], ["AS", "0S"], ["AC", "0C"]], "condition": "trump"}, "trump": {"0": false, "*": [["KD", "QD"], ["KH", "QH"], ["KS", "QS"], ["KC", "QC"]]}}}, "reveal": true, "hand": 7, "trick": true, "players": [3, 4], "points": {"trick": {"A": 11, "K": 4, "J": 2, "Q": 3, "0": 10, "9": 0}, "bidonly": {"min": 900}, "wheels": 120, "trump": {"C": 100, "H": 60, "S": 80, "D": 40}, "penalties": {"blind": {"value": -2, "op": "mul"}, "nochange": {"op": "add", "value": -100, "times": 3}, "bid": {"value": -1, "op": "mul"}}}, "bidding": {"blind": true, "min": 60, "max": 340, "distribute": true, "aftermarket": true, "pass_final": true, "talon": true, "step": 5, "pass": true}, "pass": false, "cards": ["9D", "9H", "9S", "9C", "JD", "JH", "JS", "JC", "QD", "QH", "QS", "QC", "KD", "KH", "KS", "KC", "0D", "0H", "0S", "0C", "AD", "AH", "AS", "AC"], "strengths": "9JQK0A", "order": true, "complete": {"score": 1000}}', '2020-04-18 22:07:23.000000+00:00', '2020-05-03 18:01:29.635000+00:00');

INSERT INTO templates (fk_creator, name, opts, dt_created, dt_changed) VALUES (1, 'Arschloch', '{"sort": ["strength", "suite"], "suites": "DHSC", "lead": {"0": {"ranking": -1}, "*": "trick"}, "discards": true, "move": {"cards": "*", "win": {"last": true, "level": "all"}, "pass": true, "response": {"amount": true, "level": true}, "level": true}, "hand": 19, "order": true, "players": [3, 7], "ranking": {"finish": true}, "nextgame": {"distribute": {"ranking": true, "max": 3}}, "cards": ["3D", "3H", "3S", "3C", "4D", "4H", "4S", "4C", "5D", "5H", "5S", "5C", "6D", "6H", "6S", "6C", "7D", "7H", "7S", "7C", "8D", "8H", "8S", "8C", "9D", "9H", "9S", "9C", "JD", "JH", "JS", "JC", "QD", "QH", "QS", "QC", "KD", "KH", "KS", "KC", "0D", "0H", "0S", "0C", "AD", "AH", "AS", "AC", "2D", "2H", "2S", "2C", "X", "X", "X"], "strengths": "34567890JQKA2X", "stack": true, "reveal": false}', '2020-05-03 19:46:23.843000+00:00', '2020-05-08 21:10:13.930000+00:00');


CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON games     FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON online    FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON players   FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON tables    FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON requests  FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON templates FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON users     FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();

