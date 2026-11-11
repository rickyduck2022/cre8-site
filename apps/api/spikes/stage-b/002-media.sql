ALTER TABLE users ADD COLUMN a_list_approved boolean NOT NULL DEFAULT false;

CREATE TABLE media_assets (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id),
  file_name text NOT NULL,
  stored_key text NOT NULL UNIQUE,
  expected_bytes bigint NOT NULL CHECK (expected_bytes BETWEEN 1 AND 104857600),
  checksum text,
  preview_key text,
  preview_checksum text,
  preview_bytes bigint,
  state text NOT NULL CHECK (state IN ('receiving', 'uploading', 'uploaded', 'ready', 'failed', 'deleting', 'deleted')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media_packs (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id),
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('dub', 'sample')),
  distribution text NOT NULL CHECK (distribution IN ('worldwide', 'private', 'alist')),
  a_list_public boolean NOT NULL DEFAULT false,
  licence text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  revision integer NOT NULL DEFAULT 1,
  CHECK (NOT a_list_public OR distribution = 'alist')
);

CREATE TABLE media_dubs (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id),
  asset_id text NOT NULL UNIQUE REFERENCES media_assets(id),
  title text NOT NULL,
  distribution text NOT NULL CHECK (distribution IN ('worldwide', 'private', 'alist')),
  a_list_public boolean NOT NULL DEFAULT false,
  draft_pack_id text REFERENCES media_packs(id),
  CHECK (NOT a_list_public OR distribution = 'alist')
);

CREATE TABLE media_pack_items (
  pack_id text NOT NULL REFERENCES media_packs(id),
  dub_id text NOT NULL REFERENCES media_dubs(id),
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (pack_id, dub_id),
  UNIQUE (pack_id, position)
);

CREATE TABLE media_pack_grants (
  pack_id text NOT NULL REFERENCES media_packs(id),
  user_id text NOT NULL REFERENCES users(id),
  PRIMARY KEY (pack_id, user_id)
);

CREATE TABLE media_dub_grants (
  dub_id text NOT NULL REFERENCES media_dubs(id),
  user_id text NOT NULL REFERENCES users(id),
  PRIMARY KEY (dub_id, user_id)
);

CREATE TABLE media_jobs (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('validate', 'archive')),
  asset_id text REFERENCES media_assets(id),
  pack_id text REFERENCES media_packs(id),
  revision integer,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'running', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  lease_token text,
  lease_until timestamptz,
  available_at timestamptz NOT NULL DEFAULT now(),
  result_key text,
  result_bytes bigint,
  result_checksum text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'validate' AND asset_id IS NOT NULL AND pack_id IS NULL)
    OR (kind = 'archive' AND pack_id IS NOT NULL AND asset_id IS NULL))
);
CREATE UNIQUE INDEX media_validation_asset ON media_jobs(asset_id) WHERE kind = 'validate';
CREATE UNIQUE INDEX media_archive_revision ON media_jobs(pack_id, revision) WHERE kind = 'archive';
CREATE INDEX media_job_queue ON media_jobs(state, available_at);

CREATE TABLE media_messages (
  id text PRIMARY KEY,
  sender_id text NOT NULL REFERENCES users(id),
  recipient_id text NOT NULL REFERENCES users(id),
  pack_id text NOT NULL REFERENCES media_packs(id),
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media_friendships (
  owner_id text NOT NULL REFERENCES users(id),
  friend_id text NOT NULL REFERENCES users(id),
  PRIMARY KEY (owner_id, friend_id),
  CHECK (owner_id <> friend_id)
);
