CREATE TABLE IF NOT EXISTS hot_topics (
    id TEXT PRIMARY KEY,
    icon VARCHAR(20) NOT NULL,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(200) NOT NULL,
    query TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient querying by batch_id (to get the latest batch)
CREATE INDEX IF NOT EXISTS idx_hot_topics_batch_id ON hot_topics(batch_id);
CREATE INDEX IF NOT EXISTS idx_hot_topics_created_at ON hot_topics(created_at);