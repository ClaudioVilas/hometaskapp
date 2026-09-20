CREATE TABLE IF NOT EXISTS shopping_items (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 quantity TEXT NOT NULL DEFAULT '',
 comment TEXT NOT NULL DEFAULT '',
 photo TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','purchased')),
 created_at TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id),
 purchased_at TEXT,
 purchased_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS shopping_status_created ON shopping_items(status,created_at);
