PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','member')),
 token_hash TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tasks (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
 due_date TEXT NOT NULL, priority TEXT NOT NULL CHECK(priority IN ('alta','media','baja')),
 assignee_id TEXT REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed')),
 completed_at TEXT, completed_by TEXT REFERENCES users(id), recurrence TEXT NOT NULL DEFAULT 'none' CHECK(recurrence IN ('none','daily','weekly','monthly')),
 previous_id TEXT UNIQUE REFERENCES tasks(id), completion_nonce TEXT, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS tasks_status_due ON tasks(status,due_date);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
