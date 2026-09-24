CREATE TABLE IF NOT EXISTS athletes (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  sport           TEXT NOT NULL DEFAULT 'Ciclismo',
  goal            TEXT,
  goal_date       DATE,
  intervals_id    TEXT UNIQUE,
  invite_token    TEXT UNIQUE NOT NULL,
  ftp             INTEGER,
  lthr            INTEGER,
  threshold_pace  TEXT,
  notes           TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at    TIMESTAMPTZ,
  last_sync_error TEXT
);

CREATE TABLE IF NOT EXISTS activities (
  id           SERIAL PRIMARY KEY,
  athlete_id   INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  ext_id       TEXT NOT NULL,
  date         DATE NOT NULL,
  type         TEXT,
  name         TEXT,
  moving_time  INTEGER,
  distance     REAL,
  load         REAL,
  np           REAL,
  intensity    REAL,
  avg_hr       REAL,
  avg_power    REAL,
  device       TEXT,
  raw          JSONB,
  UNIQUE (athlete_id, ext_id)
);
CREATE INDEX IF NOT EXISTS activities_athlete_date ON activities (athlete_id, date);

CREATE TABLE IF NOT EXISTS wellness (
  athlete_id  INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  ctl         REAL,
  atl         REAL,
  resting_hr  REAL,
  hrv         REAL,
  sleep_secs  INTEGER,
  weight      REAL,
  PRIMARY KEY (athlete_id, date)
);

CREATE TABLE IF NOT EXISTS planned (
  id          SERIAL PRIMARY KEY,
  athlete_id  INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  ext_id      TEXT NOT NULL,
  date        DATE NOT NULL,
  type        TEXT,
  name        TEXT,
  description TEXT,
  load        REAL,
  UNIQUE (athlete_id, ext_id)
);
CREATE INDEX IF NOT EXISTS planned_athlete_date ON planned (athlete_id, date);

CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  athlete_id  INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  sender      TEXT NOT NULL CHECK (sender IN ('coach', 'athlete')),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS messages_athlete ON messages (athlete_id, created_at);

CREATE TABLE IF NOT EXISTS folders (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library (
  id          SERIAL PRIMARY KEY,
  folder_id   INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'Ride',
  target      TEXT NOT NULL DEFAULT 'power',
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
