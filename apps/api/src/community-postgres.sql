CREATE SCHEMA cre8_community;
CREATE TABLE cre8_community.metadata (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  migration_checksum text NOT NULL,
  data_schema integer NOT NULL CHECK (data_schema = 7),
  initialized boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 0
);
CREATE TABLE cre8_community.records (
  collection text NOT NULL CHECK (collection IN (
    'users', 'artists', 'dubs', 'friendships', 'conversations', 'likes',
    'downloads', 'crates', 'uploads', 'dubGrants', 'aListApplications',
    'aListAccessDecisions', 'notifications', 'dubShares', 'pushSubscriptions', 'packs'
  )),
  position integer NOT NULL CHECK (position >= 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  PRIMARY KEY (collection, position)
);
CREATE UNIQUE INDEX community_record_id ON cre8_community.records(collection, (payload->>'id'))
  WHERE payload->>'id' IS NOT NULL;
CREATE UNIQUE INDEX community_username ON cre8_community.records(lower(payload->>'username'))
  WHERE collection = 'users';
CREATE TABLE cre8_community.sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX community_session_expiry ON cre8_community.sessions(expires_at);
