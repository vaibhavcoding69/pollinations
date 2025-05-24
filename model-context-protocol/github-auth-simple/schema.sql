-- Ultra-simplified schema for GitHub auth (thin proxy design)
CREATE TABLE IF NOT EXISTS users (
  github_user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Temporary OAuth flow state
CREATE TABLE IF NOT EXISTS oauth_state (
  state TEXT PRIMARY KEY,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auth sessions for session-based authentication
CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(github_user_id) ON DELETE CASCADE
);

-- Domains table for allowlist management
CREATE TABLE IF NOT EXISTS domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, domain),
  FOREIGN KEY (user_id) REFERENCES users(github_user_id) ON DELETE CASCADE
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_oauth_state_created ON oauth_state(created_at);
-- Index for looking up sessions by user
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
