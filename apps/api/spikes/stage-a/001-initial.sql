CREATE TABLE schema_migrations (
  version integer PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_salt text NOT NULL,
  password_hash text NOT NULL CHECK (length(password_hash) = 128)
);

CREATE TABLE artists (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  name text NOT NULL
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY CHECK (length(token_hash) = 64),
  user_id text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX sessions_expiry ON sessions(expires_at);

-- Only synthetic catalogue rows exist in Stage A; real dub policy is Stage B.
CREATE TABLE fixture_dubs (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id),
  title text NOT NULL,
  distribution text NOT NULL CHECK (distribution IN ('worldwide', 'private'))
);

CREATE TABLE crates (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  name_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name_key)
);

CREATE TABLE crate_items (
  crate_id text NOT NULL REFERENCES crates(id) ON DELETE CASCADE,
  dub_id text NOT NULL REFERENCES fixture_dubs(id),
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (crate_id, dub_id),
  UNIQUE (crate_id, position)
);

CREATE TABLE idempotency_records (
  user_id text NOT NULL REFERENCES users(id),
  key text NOT NULL CHECK (length(key) BETWEEN 1 AND 100),
  fingerprint text NOT NULL,
  status integer NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  event_type text NOT NULL,
  aggregate_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
