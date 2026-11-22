CREATE TABLE IF NOT EXISTS login_attempt_windows (
    key_hash TEXT PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempts INTEGER NOT NULL CHECK (attempts > 0)
);
CREATE INDEX IF NOT EXISTS idx_login_attempt_windows_started_at ON login_attempt_windows (started_at);
