BEGIN TRANSACTION;

INSERT OR IGNORE INTO blogspot_sync_config (k, v, updated_at) VALUES ('write_lock_enabled', '0', strftime('%s','now'));
INSERT OR IGNORE INTO blogspot_sync_config (k, v, updated_at) VALUES ('maintenance_mode', '0', strftime('%s','now'));
INSERT OR IGNORE INTO blogspot_sync_config (k, v, updated_at) VALUES ('maintenance_notice', 'Production maintenance mode is active. Review changes carefully.', strftime('%s','now'));
INSERT OR IGNORE INTO blogspot_sync_config (k, v, updated_at) VALUES ('delete_confirm_phrase', 'DELETE REMOTE BLOGSPOT', strftime('%s','now'));
INSERT OR IGNORE INTO blogspot_sync_config (k, v, updated_at) VALUES ('published_change_confirm', 'CONFIRM PUBLISHED CHANGE', strftime('%s','now'));
INSERT OR IGNORE INTO blogspot_sync_config (k, v, updated_at) VALUES ('remote_delete_requires_approval', '1', strftime('%s','now'));

COMMIT;
