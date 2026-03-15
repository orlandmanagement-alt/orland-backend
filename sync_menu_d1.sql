-- =========================================================
-- MENU SYNC
-- safe upsert style for D1/sqlite
-- =========================================================

-- ---------- parent helpers ----------
INSERT OR IGNORE INTO menus (
  id, code, label, path, parent_id, sort_order, icon, created_at, group_key
) VALUES
('m_cert_root', 'certificates', 'Certificates', '/certificates', NULL, 110, 'fa-solid fa-certificate', strftime('%s','now'), 'system'),
('m_proj_archive_root', 'projects_archive', 'Project Archive', '/projects/archive-view', NULL, 111, 'fa-solid fa-box-archive', strftime('%s','now'), 'system');

-- ---------- child menus ----------
INSERT OR IGNORE INTO menus (
  id, code, label, path, parent_id, sort_order, icon, created_at, group_key
) VALUES
('m_cert_templates', 'certificate_templates', 'Certificate Templates', '/certificates/templates', 'm_cert_root', 111, 'fa-solid fa-file-signature', strftime('%s','now'), 'system'),
('m_cert_issue', 'certificate_issue', 'Issue Certificates', '/certificates/issue', 'm_cert_root', 112, 'fa-solid fa-award', strftime('%s','now'), 'system'),
('m_proj_finish_bulk', 'projects_finish_bulk', 'Finish Project Bulk', '/projects/finish-bulk', 'm_proj_archive_root', 113, 'fa-solid fa-flag-checkered', strftime('%s','now'), 'system'),
('m_proj_archive_view', 'projects_archive_view', 'Archived Projects', '/projects/archive-view', 'm_proj_archive_root', 114, 'fa-solid fa-box-archive', strftime('%s','now'), 'system');

-- ---------- update labels/icons if already existed ----------
UPDATE menus SET
  label='Certificates',
  icon='fa-solid fa-certificate',
  sort_order=110
WHERE id='m_cert_root';

UPDATE menus SET
  label='Project Archive',
  icon='fa-solid fa-box-archive',
  sort_order=111
WHERE id='m_proj_archive_root';

UPDATE menus SET
  label='Certificate Templates',
  path='/certificates/templates',
  parent_id='m_cert_root',
  icon='fa-solid fa-file-signature',
  sort_order=111
WHERE id='m_cert_templates';

UPDATE menus SET
  label='Issue Certificates',
  path='/certificates/issue',
  parent_id='m_cert_root',
  icon='fa-solid fa-award',
  sort_order=112
WHERE id='m_cert_issue';

UPDATE menus SET
  label='Finish Project Bulk',
  path='/projects/finish-bulk',
  parent_id='m_proj_archive_root',
  icon='fa-solid fa-flag-checkered',
  sort_order=113
WHERE id='m_proj_finish_bulk';

UPDATE menus SET
  label='Archived Projects',
  path='/projects/archive-view',
  parent_id='m_proj_archive_root',
  icon='fa-solid fa-box-archive',
  sort_order=114
WHERE id='m_proj_archive_view';

-- ---------- role mapping ----------
INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at)
SELECT r.id, 'm_cert_root', strftime('%s','now')
FROM roles r
WHERE r.name IN ('super_admin','admin','staff');

INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at)
SELECT r.id, 'm_cert_templates', strftime('%s','now')
FROM roles r
WHERE r.name IN ('super_admin');

INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at)
SELECT r.id, 'm_cert_issue', strftime('%s','now')
FROM roles r
WHERE r.name IN ('super_admin','admin','staff');

INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at)
SELECT r.id, 'm_proj_archive_root', strftime('%s','now')
FROM roles r
WHERE r.name IN ('super_admin','admin','staff');

INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at)
SELECT r.id, 'm_proj_finish_bulk', strftime('%s','now')
FROM roles r
WHERE r.name IN ('super_admin','admin','staff');

INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at)
SELECT r.id, 'm_proj_archive_view', strftime('%s','now')
FROM roles r
WHERE r.name IN ('super_admin','admin','staff');

-- ---------- optional clean public-only menus from role_menus ----------
-- no action, because public routes are intentionally not inserted

-- ---------- check result ----------
SELECT 'MENUS_ADDED_OR_UPDATED' AS info;
SELECT id, code, label, path, parent_id, sort_order
FROM menus
WHERE id IN (
  'm_cert_root',
  'm_cert_templates',
  'm_cert_issue',
  'm_proj_archive_root',
  'm_proj_finish_bulk',
  'm_proj_archive_view'
)
ORDER BY sort_order ASC, id ASC;

SELECT r.name AS role_name, m.id AS menu_id, m.label, m.path
FROM role_menus rm
JOIN roles r ON r.id = rm.role_id
JOIN menus m ON m.id = rm.menu_id
WHERE m.id IN (
  'm_cert_root',
  'm_cert_templates',
  'm_cert_issue',
  'm_proj_archive_root',
  'm_proj_finish_bulk',
  'm_proj_archive_view'
)
ORDER BY r.name ASC, m.sort_order ASC, m.id ASC;
