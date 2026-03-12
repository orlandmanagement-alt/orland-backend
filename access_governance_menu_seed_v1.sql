PRAGMA foreign_keys = OFF;

INSERT OR IGNORE INTO menus (id, code, label, path, parent_id, sort_order, icon, created_at, group_key) VALUES
('m_acc_permission_matrix', 'permission_matrix', 'Permission Matrix', '/access/permission-matrix', 'm_core_access', 5, 'fa-solid fa-table-cells-large', strftime('%s','now'), 'access'),
('m_acc_role_templates', 'role_templates', 'Role Templates', '/access/role-templates', 'm_core_access', 6, 'fa-solid fa-copy', strftime('%s','now'), 'access'),
('m_acc_access_simulation', 'access_simulation', 'Access Simulation', '/access/simulation', 'm_core_access', 7, 'fa-solid fa-eye', strftime('%s','now'), 'access');

INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at) VALUES
('role_super_admin', 'm_acc_permission_matrix', strftime('%s','now')),
('role_super_admin', 'm_acc_role_templates', strftime('%s','now')),
('role_super_admin', 'm_acc_access_simulation', strftime('%s','now')),

('role_admin', 'm_acc_permission_matrix', strftime('%s','now')),
('role_admin', 'm_acc_role_templates', strftime('%s','now')),
('role_admin', 'm_acc_access_simulation', strftime('%s','now')),

('role_access_admin', 'm_acc_permission_matrix', strftime('%s','now')),
('role_access_admin', 'm_acc_role_templates', strftime('%s','now')),
('role_access_admin', 'm_acc_access_simulation', strftime('%s','now')),

('role_audit_admin', 'm_acc_permission_matrix', strftime('%s','now')),
('role_audit_admin', 'm_acc_access_simulation', strftime('%s','now'));

PRAGMA foreign_keys = ON;
