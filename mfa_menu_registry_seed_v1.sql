PRAGMA foreign_keys = OFF;

INSERT OR IGNORE INTO menus (id, code, label, path, parent_id, sort_order, icon, created_at, group_key) VALUES
('m_sec_mfa_enrollment', 'security_mfa_enrollment', 'MFA Enrollment', '/security/mfa-enrollment', 'm_sys_security', 81, 'fa-solid fa-qrcode', strftime('%s','now'), 'security'),
('m_sec_mfa_challenge', 'security_mfa_challenge', 'MFA Challenge', '/security/mfa-challenge', 'm_sys_security', 82, 'fa-solid fa-shield', strftime('%s','now'), 'security'),
('m_sec_mfa_recovery', 'security_mfa_recovery', 'Recovery Codes', '/security/mfa-recovery-codes', 'm_sys_security', 83, 'fa-solid fa-key', strftime('%s','now'), 'security'),
('m_sec_mfa_recovery_audit', 'security_mfa_recovery_audit', 'Recovery Audit', '/security/mfa-recovery-audit', 'm_sys_security', 84, 'fa-solid fa-clipboard-list', strftime('%s','now'), 'security');

INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at) VALUES
('role_super_admin', 'm_sec_mfa_enrollment', strftime('%s','now')),
('role_super_admin', 'm_sec_mfa_challenge', strftime('%s','now')),
('role_super_admin', 'm_sec_mfa_recovery', strftime('%s','now')),
('role_super_admin', 'm_sec_mfa_recovery_audit', strftime('%s','now')),

('role_admin', 'm_sec_mfa_enrollment', strftime('%s','now')),
('role_admin', 'm_sec_mfa_challenge', strftime('%s','now')),
('role_admin', 'm_sec_mfa_recovery', strftime('%s','now')),
('role_admin', 'm_sec_mfa_recovery_audit', strftime('%s','now')),

('role_security_admin', 'm_sec_mfa_enrollment', strftime('%s','now')),
('role_security_admin', 'm_sec_mfa_challenge', strftime('%s','now')),
('role_security_admin', 'm_sec_mfa_recovery', strftime('%s','now')),
('role_security_admin', 'm_sec_mfa_recovery_audit', strftime('%s','now')),

('role_audit_admin', 'm_sec_mfa_recovery_audit', strftime('%s','now'));

PRAGMA foreign_keys = ON;
