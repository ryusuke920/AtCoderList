-- 同じ問題が複数のコンテストに含まれることがある（ABC/ARC 同時開催、練習用コンテストなど）。
-- task_id だけを主キーにしていたため、後から取り込んだコンテストが前のコンテストの記号・問題名・順番を
-- 上書きし、後のコンテストの問題は 0 件になっていた。主キーを (contest_id, task_id) にして取り込み直す。
-- コンテスト一覧（atcoder_contests）は残し、問題一覧と配点だけを消して未取得に戻す。
DROP TABLE atcoder_tasks;

CREATE TABLE atcoder_tasks (
  contest_id     TEXT    NOT NULL REFERENCES atcoder_contests(contest_id) ON DELETE CASCADE,
  task_id        TEXT    NOT NULL,              -- 例: abc400_a（別のコンテストの ID のこともある）
  position       INTEGER NOT NULL,
  label          TEXT    NOT NULL,
  title          TEXT    NOT NULL,
  score          INTEGER,
  score_fetched  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (contest_id, task_id)
);
CREATE INDEX idx_atcoder_tasks_contest ON atcoder_tasks(contest_id, position);
CREATE INDEX idx_atcoder_tasks_score_pending ON atcoder_tasks(score_fetched) WHERE score_fetched = 0;

UPDATE atcoder_contests SET tasks_status = 0;
