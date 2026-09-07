-- Reemplaza el ingreso por enlace de acceso (token_hash) por usuario y
-- contraseña. token_hash tiene UNIQUE, así que SQLite no permite soltar
-- esa columna sola, y D1 aplica claves foráneas por defecto (a diferencia
-- de SQLite estándar), así que tampoco alcanza con soltar y recrear
-- users sola: se reconstruyen las tres tablas preservando sus datos,
-- soltando primero a las que referencian a "users" (sessions, tasks) y
-- recién al final a "users".
CREATE TABLE users_new (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','member')),
 username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
INSERT INTO users_new (id,name,role,username,password_hash,password_salt,active,created_at)
 SELECT id,name,role,lower(id),'','',active,created_at FROM users;
CREATE TABLE sessions_new (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users_new(id),expires_at TEXT NOT NULL);
INSERT INTO sessions_new SELECT * FROM sessions;
CREATE TABLE tasks_new (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
 due_date TEXT NOT NULL, priority TEXT NOT NULL CHECK(priority IN ('alta','media','baja')),
 assignee_id TEXT REFERENCES users_new(id), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed')),
 completed_at TEXT, completed_by TEXT REFERENCES users_new(id), recurrence TEXT NOT NULL DEFAULT 'none' CHECK(recurrence IN ('none','daily','weekly','monthly')),
 previous_id TEXT UNIQUE REFERENCES tasks_new(id), completion_nonce TEXT, deleted_at TEXT
);
INSERT INTO tasks_new SELECT * FROM tasks;
DROP TABLE tasks;
DROP TABLE sessions;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
ALTER TABLE sessions_new RENAME TO sessions;
ALTER TABLE tasks_new RENAME TO tasks;
CREATE INDEX IF NOT EXISTS tasks_status_due ON tasks(status,due_date);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
