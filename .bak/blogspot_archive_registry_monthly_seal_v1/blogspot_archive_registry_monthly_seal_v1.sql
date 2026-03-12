BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS blogspot_archive_registry (
  id TEXT PRIMARY KEY,
  archive_no TEXT NOT NULL UNIQUE,
  archive_name TEXT NOT NULL,
  archive_version TEXT NOT NULL,
  period_key TEXT NOT NULL,
  range_from INTEGER NOT NULL DEFAULT 0,
  range_to INTEGER NOT NULL DEFAULT 0,
  snapshot_hash TEXT,
  logs_hash TEXT,
  approvals_hash TEXT,
  delete_requests_hash TEXT,
  risk_register_hash TEXT,
  bundle_signature_mode TEXT,
  bundle_signature_algorithm TEXT,
  bundle_signature_value TEXT,
  item_logs_count INTEGER NOT NULL DEFAULT 0,
  item_approvals_count INTEGER NOT NULL DEFAULT 0,
  item_delete_requests_count INTEGER NOT NULL DEFAULT 0,
  item_risk_count INTEGER NOT NULL DEFAULT 0,
  registered_by TEXT,
  registered_at INTEGER NOT NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_bar_period_key
ON blogspot_archive_registry(period_key, registered_at DESC);

CREATE INDEX IF NOT EXISTS idx_bar_registered_at
ON blogspot_archive_registry(registered_at DESC);

CREATE TABLE IF NOT EXISTS blogspot_archive_monthly_seals (
  id TEXT PRIMARY KEY,
  seal_no TEXT NOT NULL UNIQUE,
  period_key TEXT NOT NULL UNIQUE,
  archive_count INTEGER NOT NULL DEFAULT 0,
  registry_digest TEXT NOT NULL,
  seal_signature_mode TEXT,
  seal_signature_algorithm TEXT,
  seal_signature_value TEXT,
  sealed_by TEXT,
  sealed_at INTEGER NOT NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_bams_period_key
ON blogspot_archive_monthly_seals(period_key, sealed_at DESC);

COMMIT;
