CREATE TABLE IF NOT EXISTS oncall_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oncall_roster (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_oncall_groups_status
ON oncall_groups(status);

CREATE INDEX IF NOT EXISTS idx_oncall_roster_group
ON oncall_roster(group_id);

CREATE INDEX IF NOT EXISTS idx_oncall_roster_user
ON oncall_roster(user_id);
