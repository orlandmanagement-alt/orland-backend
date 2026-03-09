INSERT OR IGNORE INTO system_settings (k,v,is_secret,updated_at) VALUES ('cf_analytics_enabled','0',0,strftime('%s','now'));
INSERT OR IGNORE INTO system_settings (k,v,is_secret,updated_at) VALUES ('cf_analytics_account_id','',0,strftime('%s','now'));
INSERT OR IGNORE INTO system_settings (k,v,is_secret,updated_at) VALUES ('cf_analytics_zone_tag','',0,strftime('%s','now'));
INSERT OR IGNORE INTO system_settings (k,v,is_secret,updated_at) VALUES ('cf_analytics_token','',1,strftime('%s','now'));
