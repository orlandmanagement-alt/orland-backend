PRAGMA foreign_keys = OFF;

CREATE INDEX IF NOT EXISTS idx_users_email_norm ON users(email_norm);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_session_version ON users(session_version);
CREATE INDEX IF NOT EXISTS idx_users_mfa_enabled ON users(mfa_enabled);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_revoked_at ON sessions(revoked_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_revoked ON sessions(user_id, revoked_at);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

CREATE INDEX IF NOT EXISTS idx_role_menus_role_id ON role_menus(role_id);
CREATE INDEX IF NOT EXISTS idx_role_menus_menu_id ON role_menus(menu_id);

CREATE INDEX IF NOT EXISTS idx_menus_code ON menus(code);
CREATE INDEX IF NOT EXISTS idx_menus_path ON menus(path);
CREATE INDEX IF NOT EXISTS idx_menus_parent_id ON menus(parent_id);
CREATE INDEX IF NOT EXISTS idx_menus_group_key ON menus(group_key);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_route ON audit_logs(route);

CREATE INDEX IF NOT EXISTS idx_system_settings_k ON system_settings(k);
CREATE INDEX IF NOT EXISTS idx_ip_blocks_ip_hash ON ip_blocks(ip_hash);
CREATE INDEX IF NOT EXISTS idx_request_counters_k ON request_counters(k);

PRAGMA foreign_keys = ON;
