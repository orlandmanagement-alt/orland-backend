PRAGMA foreign_keys = OFF;

INSERT OR IGNORE INTO menus (id, code, label, path, parent_id, sort_order, icon, created_at, group_key) VALUES
('m_acc_registry_audit', 'registry_audit', 'Registry Audit', '/registry-audit', 'm_core_access', 4, 'fa-solid fa-route', strftime('%s','now'), 'access');

INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at) VALUES
('role_super_admin', 'm_acc_registry_audit', strftime('%s','now')),
('role_admin', 'm_acc_registry_audit', strftime('%s','now')),
('role_access_admin', 'm_acc_registry_audit', strftime('%s','now')),
('role_security_admin', 'm_acc_registry_audit', strftime('%s','now')),
('role_audit_admin', 'm_acc_registry_audit', strftime('%s','now'));

PRAGMA foreign_keys = ON;
