-- ユーザー（GitHub アカウントと 1:1）
CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id   INTEGER NOT NULL UNIQUE,
  username    TEXT    NOT NULL,
  avatar_url  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ログインセッション。Cookie にはランダムトークン、DB にはその SHA-256 のみ保存する
CREATE TABLE sessions (
  token_hash  TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL -- unix epoch (秒)
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- 問題。difficulty / status は表示色ではなく列挙値で持つ
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

-- 問題に付けるアルゴリズムタグ（旧版は 1 問 1 ジャンルだったのを多対多に）
CREATE TABLE problem_tags (
  problem_id  INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  tag         TEXT    NOT NULL,
  PRIMARY KEY (problem_id, tag)
);
CREATE INDEX idx_problem_tags_tag ON problem_tags(tag);
