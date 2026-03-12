PRAGMA foreign_keys = OFF;

INSERT OR IGNORE INTO menus (id, code, label, path, parent_id, sort_order, icon, created_at, group_key) VALUES
('m_acc_protected_menu_policy', 'protected_menu_policy', 'Protected Menu Policy', '/access/protected-menu-policy', 'm_core_access', 8, 'fa-solid fa-lock', strftime('%s','now'), 'access'),
('m_users_lifecycle', 'user_lifecycle', 'User Lifecycle', '/users/lifecycle', 'm_core_users', 25, 'fa-solid fa-user-clock', strftime('%s','now'), 'users'),
('m_acc_access_review_approval', 'access_review_approval', 'Access Review Approval', '/access/reviews', 'm_core_access', 9, 'fa-solid fa-clipboard-check', strftime('%s','now'), 'access');

INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at) VALUES
('role_super_admin', 'm_acc_protected_menu_policy', strftime('%s','now')),
('role_super_admin', 'm_users_lifecycle', strftime('%s','now')),
('role_super_admin', 'm_acc_access_review_approval', strftime('%s','now')),

('role_admin', 'm_users_lifecycle', strftime('%s','now')),
('role_admin', 'm_acc_access_review_approval', strftime('%s','now')),

('role_access_admin', 'm_acc_protected_menu_policy', strftime('%s','now')),
('role_access_admin', 'm_acc_access_review_approval', strftime('%s','now')),

('role_security_admin', 'm_users_lifecycle', strftime('%s','now')),
('role_audit_admin', 'm_acc_access_review_approval', strftime('%s','now'));

PRAGMA foreign_keys = ON;
