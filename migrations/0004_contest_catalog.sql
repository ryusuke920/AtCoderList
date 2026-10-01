-- コンテスト一覧（サジェスト用）。アーカイブから取り込むので、問題一覧が未取得の回も入る
ALTER TABLE atcoder_contests ADD COLUMN title TEXT;
ALTER TABLE atcoder_contests ADD COLUMN start_at TEXT;   -- 例: 2026-09-26 21:00:00+0900
ALTER TABLE atcoder_contests ADD COLUMN kind TEXT;       -- algorithm / heuristic
-- 問題一覧の取得状態: 0 = 未取得, 1 = 取得済み, -1 = 取得できなかった（問題非公開など。再試行しない）
ALTER TABLE atcoder_contests ADD COLUMN tasks_status INTEGER NOT NULL DEFAULT 0;

-- これまでの行は問題一覧を取り込んだときに作られたもの
UPDATE atcoder_contests SET tasks_status = 1;

CREATE INDEX idx_atcoder_contests_start ON atcoder_contests(start_at DESC);
CREATE INDEX idx_atcoder_tasks_score_pending ON atcoder_tasks(score_fetched) WHERE score_fetched = 0;

-- 取り込みジョブの進捗（アーカイブを何ページ目まで読んだか など）
CREATE TABLE sync_state (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
