CREATE TABLE IF NOT EXISTS trend_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    search_term TEXT NOT NULL,
    headline TEXT NOT NULL,
    summary TEXT NOT NULL,
    key_points TEXT NOT NULL,
    call_to_action TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_trend_history_user_id ON trend_history(user_id);
CREATE INDEX IF NOT EXISTS idx_trend_history_created_at ON trend_history(created_at);
CREATE INDEX IF NOT EXISTS idx_trend_history_user_created ON trend_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_history_search_term ON trend_history(search_term);