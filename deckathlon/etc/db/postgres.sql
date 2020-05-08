CREATE OR REPLACE FUNCTION update_row_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.dt_changed = now();
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
  active     BIGINT    NOT NULL DEFAULT 0,
  dt_online  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  dt_created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dt_changed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);


CREATE TABLE players (
  id         BIGSERIAL,
  fk_table   BIGINT    NOT NULL,
  fk_game    BIGINT,
  fk_user    BIGINT    NOT NULL,
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
  public         BIGINT    NOT NULL DEFAULT 0,
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

ALTER TABLE table_users
  ADD CONSTRAINT fk_table_users_tables FOREIGN KEY ( fk_table    ) REFERENCES tables   ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_table_users_users  FOREIGN KEY ( fk_user     ) REFERENCES users    ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE tables
  ADD CONSTRAINT fk_tables_templates   FOREIGN KEY ( fk_template ) REFERENCES templates ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_tables_creators    FOREIGN KEY ( fk_creator  ) REFERENCES users     ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_tables_hosts       FOREIGN KEY ( fk_host     ) REFERENCES users     ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT;
                                       
ALTER TABLE templates                  
  ADD CONSTRAINT fk_templates_users    FOREIGN KEY ( fk_creator  ) REFERENCES users     ( id ) ON DELETE RESTRICT ON UPDATE RESTRICT;


CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON games     FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON online    FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON players   FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON tables    FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
CREATE TRIGGER a_update_row_timestamp BEFORE UPDATE ON templates FOR EACH ROW EXECUTE PROCEDURE update_row_timestamp();
