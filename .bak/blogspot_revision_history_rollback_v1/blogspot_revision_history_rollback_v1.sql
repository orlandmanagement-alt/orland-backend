BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS blogspot_revision_history (
  id TEXT PRIMARY KEY,
  item_kind TEXT NOT NULL,
  item_id TEXT NOT NULL,
  revision_no INTEGER NOT NULL,
  source_action TEXT NOT NULL,
  actor_user_id TEXT,
  title TEXT,
  slug TEXT,
  status TEXT,
  snapshot_json TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brh_item_rev
ON blogspot_revision_history(item_kind, item_id, revision_no);

CREATE INDEX IF NOT EXISTS idx_brh_item_created
ON blogspot_revision_history(item_kind, item_id, created_at DESC);

COMMIT;
