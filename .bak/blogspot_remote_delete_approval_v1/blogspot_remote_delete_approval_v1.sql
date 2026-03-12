BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS blogspot_remote_delete_requests (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  local_id TEXT NOT NULL,
  remote_id TEXT,
  title TEXT,
  slug TEXT,
  reason TEXT,
  requested_by TEXT,
  requested_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by TEXT,
  decided_at INTEGER,
  decision_note TEXT,
  executed_by TEXT,
  executed_at INTEGER,
  result_status TEXT,
  result_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_brdr_status ON blogspot_remote_delete_requests(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_brdr_local ON blogspot_remote_delete_requests(local_id, kind);

COMMIT;
