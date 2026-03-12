PRAGMA foreign_keys = OFF;

INSERT OR IGNORE INTO menus (id, code, label, path, parent_id, sort_order, icon, created_at, group_key) VALUES
('m_sec_center', 'security_center', 'Security Center', '/security/center', 'm_sys_security', 75, 'fa-solid fa-user-shield', strftime('%s','now'), 'security'),
('m_sec_sessions_admin', 'security_sessions_admin', 'Session Control', '/security/sessions', 'm_sys_security', 76, 'fa-solid fa-computer', strftime('%s','now'), 'security'),
('m_sec_login_timeline', 'security_login_timeline', 'Login Timeline', '/security/login-timeline', 'm_sys_security', 77, 'fa-solid fa-timeline', strftime('%s','now'), 'security'),
('m_sec_force_password', 'security_force_password', 'Forced Password Reset', '/security/force-password-reset', 'm_sys_security', 78, 'fa-solid fa-key', strftime('%s','now'), 'security'),
('m_sec_bootstrap_admin', 'security_bootstrap_admin', 'Bootstrap Admin', '/security/bootstrap-admin', 'm_sys_security', 79, 'fa-solid fa-power-off', strftime('%s','now'), 'security'),
('m_sec_mfa_policy', 'security_mfa_policy', 'MFA Policy', '/security/mfa-policy', 'm_sys_security', 80, 'fa-solid fa-mobile-screen-button', strftime('%s','now'), 'security');

INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at) VALUES
('role_super_admin', 'm_sec_center', strftime('%s','now')),
('role_super_admin', 'm_sec_sessions_admin', strftime('%s','now')),
('role_super_admin', 'm_sec_login_timeline', strftime('%s','now')),
('role_super_admin', 'm_sec_force_password', strftime('%s','now')),
('role_super_admin', 'm_sec_bootstrap_admin', strftime('%s','now')),
('role_super_admin', 'm_sec_mfa_policy', strftime('%s','now')),

('role_admin', 'm_sec_center', strftime('%s','now')),
('role_admin', 'm_sec_sessions_admin', strftime('%s','now')),
('role_admin', 'm_sec_login_timeline', strftime('%s','now')),
('role_admin', 'm_sec_force_password', strftime('%s','now')),
('role_admin', 'm_sec_mfa_policy', strftime('%s','now')),

('role_security_admin', 'm_sec_center', strftime('%s','now')),
('role_security_admin', 'm_sec_sessions_admin', strftime('%s','now')),
('role_security_admin', 'm_sec_login_timeline', strftime('%s','now')),
('role_security_admin', 'm_sec_force_password', strftime('%s','now')),
('role_security_admin', 'm_sec_mfa_policy', strftime('%s','now')),

('role_audit_admin', 'm_sec_login_timeline', strftime('%s','now'));

PRAGMA foreign_keys = ON;
