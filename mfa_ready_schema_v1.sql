-- MFA Ready Schema + Toggle Pack v1
-- Jalankan PER BARIS hanya jika kolom belum ada.
-- Karena pada banyak environment SQLite/D1, ALTER TABLE ADD COLUMN akan gagal jika kolom sudah ada.

ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN mfa_type TEXT;
ALTER TABLE users ADD COLUMN mfa_secret TEXT;
ALTER TABLE users ADD COLUMN recovery_codes_json TEXT;
