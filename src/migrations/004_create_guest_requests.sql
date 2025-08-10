CREATE TABLE IF NOT EXISTS guest_requests (
  id TEXT PRIMARY KEY,
  ip_address TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_guest_requests_ip ON guest_requests(ip_address);