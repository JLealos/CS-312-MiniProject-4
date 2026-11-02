CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(255) PRIMARY KEY,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS blogs (
  blog_id SERIAL PRIMARY KEY,
  creator_name VARCHAR(255) NOT NULL,
  creator_user_id VARCHAR(255) NOT NULL REFERENCES users(user_id),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  date_created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_updated TIMESTAMP,
  tags TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS blogs_creator_idx ON blogs(creator_user_id);

CREATE TABLE IF NOT EXISTS blog_reactions (
  blog_id INTEGER NOT NULL REFERENCES blogs(blog_id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id),
  reaction VARCHAR(7) NOT NULL CHECK (reaction IN ('like', 'dislike')),
  PRIMARY KEY (blog_id, user_id)
);

CREATE TABLE IF NOT EXISTS "session" (
  sid VARCHAR PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS session_expire_idx ON "session"(expire);
