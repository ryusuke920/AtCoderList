-- AtCoder ID と、AtCoder Problems の提出 API をどこまで読んだか
ALTER TABLE users ADD COLUMN atcoder_id TEXT;
ALTER TABLE users ADD COLUMN submissions_cursor INTEGER NOT NULL DEFAULT 0; -- 次に読む from_second
ALTER TABLE users ADD COLUMN submissions_synced_at TEXT;

-- ユーザーごと・問題ごとの提出結果のまとめ（AC したことがあるか、最後の結果）
CREATE TABLE user_task_results (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id      TEXT    NOT NULL,              -- 例: abc400_a
  has_ac       INTEGER NOT NULL DEFAULT 0,
  last_result  TEXT,                          -- WA / TLE / MLE / RE / CE / AC
  last_epoch   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, task_id)
);

-- 問題の URL から取り出した AtCoder の問題 ID（提出結果との突き合わせ用）
ALTER TABLE problems ADD COLUMN task_id TEXT;
UPDATE problems
   SET task_id = substr(url, instr(url, '/tasks/') + 7)
 WHERE url LIKE '%atcoder.jp/contests/%/tasks/%';
UPDATE problems SET task_id = substr(task_id, 1, instr(task_id, '?') - 1) WHERE instr(task_id, '?') > 0;
UPDATE problems SET task_id = substr(task_id, 1, instr(task_id, '#') - 1) WHERE instr(task_id, '#') > 0;
UPDATE problems SET task_id = substr(task_id, 1, instr(task_id, '/') - 1) WHERE instr(task_id, '/') > 0;
CREATE INDEX idx_problems_user_task ON problems(user_id, task_id);
