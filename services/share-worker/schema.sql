CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, state TEXT NOT NULL, byte_size INTEGER NOT NULL, checksum TEXT NOT NULL, content_type TEXT NOT NULL, storage_key TEXT NOT NULL, multipart_upload_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS upload_parts (upload_id TEXT NOT NULL, part_number INTEGER NOT NULL, etag TEXT NOT NULL, byte_size INTEGER NOT NULL, PRIMARY KEY(upload_id,part_number));
CREATE TABLE IF NOT EXISTS shares (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, upload_id TEXT NOT NULL, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, visibility TEXT NOT NULL, revoked INTEGER DEFAULT 0, expires_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS share_members (share_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY (share_id,user_id));
CREATE TABLE IF NOT EXISTS share_comments (id TEXT PRIMARY KEY, share_id TEXT NOT NULL, author_id TEXT NOT NULL, author_name TEXT NOT NULL, timestamp_ms INTEGER NOT NULL, body TEXT NOT NULL, resolved INTEGER DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_shares_owner ON shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_comments_share ON share_comments(share_id);
