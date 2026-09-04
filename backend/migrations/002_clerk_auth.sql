ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id text UNIQUE;
CREATE INDEX IF NOT EXISTS users_clerk_user_id_idx ON users(clerk_user_id);
