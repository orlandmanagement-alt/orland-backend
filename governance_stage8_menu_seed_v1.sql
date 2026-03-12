PRAGMA foreign_keys = OFF;

INSERT OR IGNORE INTO menus (id, code, label, path, parent_id, sort_order, icon, created_at, group_key) VALUES
('m_users_offboarding', 'user_offboarding', 'User Offboarding', '/users/offboarding', 'm_core_users', 26, 'fa-solid fa-user-slash', strftime('%s','now'), 'users'),
('m_acc_review_apply', 'access_review_apply', 'Access Review Apply', '/access/reviews/apply', 'm_core_access', 10, 'fa-solid fa-check-double', strftime('%s','now'), 'access');

INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at) VALUES
('role_super_admin', 'm_users_offboarding', strftime('%s','now')),
('role_super_admin', 'm_acc_review_apply', strftime('%s','now')),
('role_admin', 'm_users_offboarding', strftime('%s','now')),
('role_security_admin', 'm_users_offboarding', strftime('%s','now')),
('role_access_admin', 'm_acc_review_apply', strftime('%s','now'));

PRAGMA foreign_keys = ON;
