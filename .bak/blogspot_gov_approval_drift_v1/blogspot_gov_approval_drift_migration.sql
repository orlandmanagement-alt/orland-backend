BEGIN TRANSACTION;

-- add config defaults if missing
INSERT OR IGNORE INTO blogspot_sync_config (k, v, updated_at) VALUES ('approval_required_publish', '1', strftime('%s','now'));
INSERT OR IGNORE INTO blogspot_sync_config (k, v, updated_at) VALUES ('approval_required_delete', '1', strftime('%s','now'));
INSERT OR IGNORE INTO blogspot_sync_config (k, v, updated_at) VALUES ('drift_scan_enabled', '1', strftime('%s','now'));
INSERT OR IGNORE INTO blogspot_sync_config (k, v, updated_at) VALUES ('protect_published_content', '1', strftime('%s','now'));

COMMIT;
