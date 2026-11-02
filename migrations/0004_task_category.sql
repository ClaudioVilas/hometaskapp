ALTER TABLE tasks ADD COLUMN category TEXT NOT NULL DEFAULT 'claudio' CHECK(category IN ('claudio','china','it'));
