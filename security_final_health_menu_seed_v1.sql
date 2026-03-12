PRAGMA foreign_keys = OFF;

INSERT OR IGNORE INTO menus (id, code, label, path, parent_id, sort_order, icon, created_at, group_key) VALUES
('m_sec_final_health', 'security_final_health', 'Security Final Health', '/security/final-health', 'm_sys_security', 87, 'fa-solid fa-heart-pulse', strftime('%s','now'), 'security');

INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at) VALUES
('role_super_admin', 'm_sec_final_health', strftime('%s','now')),
('role_admin', 'm_sec_final_health', strftime('%s','now')),
('role_security_admin', 'm_sec_final_health', strftime('%s','now')),
('role_audit_admin', 'm_sec_final_health', strftime('%s','now'));

PRAGMA foreign_keys = ON;
