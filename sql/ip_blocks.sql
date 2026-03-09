CREATE TABLE IF NOT EXISTS ip_blocks (
  id TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER,
  actor_user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_ip_blocks_active ON ip_blocks(revoked_at, expires_at, created_at);
CREATE INDEX IF NOT EXISTS idx_ip_blocks_ip_hash ON ip_blocks(ip_hash);
