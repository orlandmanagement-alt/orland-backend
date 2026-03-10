CREATE TABLE IF NOT EXISTS hourly_metrics (
  metric_key TEXT NOT NULL,
  metric_value INTEGER NOT NULL DEFAULT 0,
  bucket_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hourly_metrics_key_time
ON hourly_metrics(metric_key, bucket_at);

CREATE TABLE IF NOT EXISTS daily_metrics (
  metric_key TEXT NOT NULL,
  metric_value INTEGER NOT NULL DEFAULT 0,
  bucket_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_key_time
ON daily_metrics(metric_key, bucket_at);
