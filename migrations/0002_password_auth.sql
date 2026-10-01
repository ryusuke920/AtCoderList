-- GitHub OAuth から ID/パスワード認証に切り替え。
-- 適用時点で本番にユーザー・問題は 0 件だったので、テーブルごと作り直す。
DROP TABLE problem_tags;
DROP TABLE problems;
DROP TABLE sessions;
DROP TABLE users;

CREATE TABLE users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  -- "pbkdf2-sha256$<反復回数>$<salt(base64)>$<hash(base64)>"
  password_hash  TEXT    NOT NULL,
  failed_logins  INTEGER NOT NULL DEFAULT 0,
  locked_until   INTEGER NOT NULL DEFAULT 0, -- unix epoch (秒)
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash  TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE problems (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  difficulty  TEXT    NOT NULL DEFAULT 'unset'
              CHECK (difficulty IN ('unset','gray','brown','green','cyan','blue','yellow','orange','red')),
  status      TEXT    NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo','AC','WA','TLE','MLE','RE','CE')),
  memo        TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, url)
);
CREATE INDEX idx_problems_user_updated ON problems(user_id, updated_at DESC);

CREATE TABLE problem_tags (
  problem_id  INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  tag         TEXT    NOT NULL,
  PRIMARY KEY (problem_id, tag)
);
CREATE INDEX idx_problem_tags_tag ON problem_tags(tag);
