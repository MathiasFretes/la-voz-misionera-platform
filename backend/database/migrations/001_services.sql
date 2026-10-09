CREATE TABLE services (
  id text PRIMARY KEY,
  schema_version text NOT NULL CHECK (schema_version = '0.1'),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  starts_at timestamptz NOT NULL,
  starts_at_text text NOT NULL,
  setlist_id text NOT NULL,
  setlist_name text NOT NULL,
  venue text NOT NULL DEFAULT '',
  worship_after_item_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE service_items (
  service_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  kind text NOT NULL CHECK (kind IN ('SONG', 'SCRIPTURE', 'ANNOUNCEMENT', 'SERMON')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  PRIMARY KEY (service_id, item_id),
  UNIQUE (service_id, position),
  CHECK (payload->>'id' = item_id),
  CHECK (payload->>'kind' = kind)
);

CREATE INDEX services_starts_at_idx ON services (starts_at DESC);
