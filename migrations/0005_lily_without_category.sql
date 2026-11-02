ALTER TABLE tasks ADD COLUMN category_new TEXT DEFAULT 'claudio' CHECK(category_new IN ('claudio','china','it'));
UPDATE tasks SET category_new=CASE WHEN assignee_id IN (SELECT id FROM users WHERE username='lily') THEN NULL ELSE category END;
ALTER TABLE tasks DROP COLUMN category;
ALTER TABLE tasks RENAME COLUMN category_new TO category;
