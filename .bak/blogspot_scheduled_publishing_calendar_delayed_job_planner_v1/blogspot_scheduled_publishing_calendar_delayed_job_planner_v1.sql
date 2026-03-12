BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS blogspot_schedule_jobs (
  id TEXT PRIMARY KEY,
  item_kind TEXT NOT NULL,
  item_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  planned_at INTEGER NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  status TEXT NOT NULL DEFAULT 'scheduled',
  payload_json TEXT NOT NULL DEFAULT '{}',
  note TEXT,
  queued_job_id TEXT,
  last_error TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bssj_status_planned
ON blogspot_schedule_jobs(status, planned_at);

CREATE INDEX IF NOT EXISTS idx_bssj_item
ON blogspot_schedule_jobs(item_kind, item_id, planned_at DESC);

COMMIT;
