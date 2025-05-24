-- Add PKCE support for OAuth 2.1 compliance
CREATE TABLE IF NOT EXISTS pkce_sessions (
  state TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for cleanup of old PKCE sessions
CREATE INDEX IF NOT EXISTS idx_pkce_sessions_created ON pkce_sessions(created_at);
