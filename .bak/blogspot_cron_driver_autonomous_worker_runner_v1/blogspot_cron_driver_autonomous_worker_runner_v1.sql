BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS blogspot_job_worker_state (
  worker_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'idle',
  last_heartbeat_at INTEGER NOT NULL DEFAULT 0,
  last_started_at INTEGER NOT NULL DEFAULT 0,
  last_finished_at INTEGER NOT NULL DEFAULT 0,
  last_result_json TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS blogspot_job_runner_config (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

COMMIT;
