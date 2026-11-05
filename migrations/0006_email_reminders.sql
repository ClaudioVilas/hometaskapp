ALTER TABLE tasks ADD COLUMN email_reminder INTEGER NOT NULL DEFAULT 0 CHECK(email_reminder IN (0,1));
CREATE TABLE task_email_deliveries (
 task_id TEXT NOT NULL REFERENCES tasks(id),
 due_date TEXT NOT NULL,
 attempted_at TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('sending','sent','failed')),
 PRIMARY KEY(task_id,due_date)
);
CREATE INDEX tasks_email_reminders ON tasks(due_date) WHERE email_reminder=1 AND status='pending' AND deleted_at IS NULL;
