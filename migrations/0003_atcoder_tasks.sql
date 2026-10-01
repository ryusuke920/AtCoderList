-- 問題の配点（AtCoder から自動取得、または手入力。古いコンテストなど配点がない場合は NULL）
ALTER TABLE problems ADD COLUMN score INTEGER CHECK (score IS NULL OR score >= 0);

-- AtCoder から取得した問題一覧のキャッシュ。同じページを二度取りにいかないためのもの
CREATE TABLE atcoder_contests (
  contest_id  TEXT    PRIMARY KEY,
  fetched_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE atcoder_tasks (
  task_id        TEXT    PRIMARY KEY,           -- 例: abc400_a
  contest_id     TEXT    NOT NULL REFERENCES atcoder_contests(contest_id) ON DELETE CASCADE,
  position       INTEGER NOT NULL,              -- 一覧での並び順
  label          TEXT    NOT NULL,              -- 例: A
  title          TEXT    NOT NULL,              -- 例: ABC400 Party
  score          INTEGER,                       -- 配点（取得済みで配点なしなら NULL）
  score_fetched  INTEGER NOT NULL DEFAULT 0     -- 問題ページを取得済みか
);
CREATE INDEX idx_atcoder_tasks_contest ON atcoder_tasks(contest_id, position);
