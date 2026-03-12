BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS blogspot_job_queue (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER NOT NULL DEFAULT 100,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_after INTEGER NOT NULL DEFAULT 0,
  locked_at INTEGER,
  locked_by TEXT,
  last_error TEXT,
  result_json TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bjq_status_run_after
ON blogspot_job_queue(status, run_after, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_bjq_job_type_status
ON blogspot_job_queue(job_type, status, created_at DESC);

CREATE TABLE IF NOT EXISTS blogspot_job_dead_letter (
  id TEXT PRIMARY KEY,
  source_job_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  result_json TEXT,
  moved_at INTEGER NOT NULL,
  moved_by TEXT,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_bjdl_job_type_moved_at
ON blogspot_job_dead_letter(job_type, moved_at DESC);

COMMIT;
