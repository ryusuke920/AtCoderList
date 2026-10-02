// AtCoder ID の登録と、提出結果にもとづく状態の自動更新。
// 提出データは AtCoder Problems の API をブラウザが直接読み（CORS 許可あり）、
// 問題ごとに集計した結果だけをここに送ってくる。サーバーは外部にアクセスしない。

import { Hono } from "hono";
import {
  ATCODER_ID_PATTERN,
  MAX_TASK_RESULTS_PER_REQUEST,
  SYNCABLE_RESULTS,
  type TaskResult,
} from "../shared/domain";
import { requireUser, selectUser } from "./auth";
import type { AppEnv } from "./types";

const D1_BATCH_SIZE = 200;
const IN_CHUNK = 90; // D1 のバインド変数は 100 個まで

async function batchAll(db: D1Database, statements: D1PreparedStatement[]) {
  for (let i = 0; i < statements.length; i += D1_BATCH_SIZE) await db.batch(statements.slice(i, i + D1_BATCH_SIZE));
}

/**
 * 指定した問題 ID について、提出結果から状態を反映する。AC したことがあれば AC、なければ最後の結果。
 * 手で変えた状態を毎回上書きしないよう、今回結果が変わった問題（と新しく追加した問題）だけを対象にする
 */
export async function applyTaskResults(db: D1Database, userId: number, taskIds: string[]): Promise<number> {
  let changed = 0;
  for (let i = 0; i < taskIds.length; i += IN_CHUNK) {
    const chunk = taskIds.slice(i, i + IN_CHUNK);
    const { meta } = await db
      .prepare(
        `UPDATE problems
            SET status = CASE WHEN r.has_ac = 1 THEN 'AC' ELSE r.last_result END,
                updated_at = datetime('now')
           FROM user_task_results r
          WHERE r.user_id = problems.user_id AND r.task_id = problems.task_id
            AND problems.user_id = ? AND problems.task_id IN (${chunk.map(() => "?").join(",")})
            AND (r.has_ac = 1 OR r.last_result IS NOT NULL)
            AND problems.status <> CASE WHEN r.has_ac = 1 THEN 'AC' ELSE r.last_result END`,
      )
      .bind(userId, ...chunk)
      .run();
    changed += meta.changes;
  }
  return changed;
}

function parseResults(raw: unknown): TaskResult[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_TASK_RESULTS_PER_REQUEST) return null;
  const results: TaskResult[] = [];
  for (const r of raw) {
    if (typeof r !== "object" || r === null) return null;
    const { taskId, ac, lastResult, lastEpoch } = r as Record<string, unknown>;
    if (typeof taskId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(taskId)) return null;
    if (typeof ac !== "boolean" || typeof lastEpoch !== "number" || !Number.isInteger(lastEpoch) || lastEpoch < 0) return null;
    if (lastResult !== null && !SYNCABLE_RESULTS.includes(lastResult as never)) return null;
    results.push({ taskId, ac, lastResult: lastResult as TaskResult["lastResult"], lastEpoch });
  }
  return results;
}

export const submissionRoutes = new Hono<AppEnv>()
  .use("*", requireUser)
  .put("/atcoder-id", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { atcoderId?: unknown } | null;
    const raw = body?.atcoderId;
    const atcoderId = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
    if (atcoderId !== null && !ATCODER_ID_PATTERN.test(atcoderId)) {
      return c.json({ error: "AtCoder ID は半角英数字と「_」の 3〜16 文字です" }, 400);
    }
    const user = c.var.user!;
    if (atcoderId !== user.atcoderId) {
      // ID を変えたら、前の ID の提出結果は捨てて最初から読み直す
      await c.env.DB.batch([
        c.env.DB.prepare(
          "UPDATE users SET atcoder_id = ?, submissions_cursor = 0, submissions_synced_at = NULL WHERE id = ?",
        ).bind(atcoderId, user.id),
        c.env.DB.prepare("DELETE FROM user_task_results WHERE user_id = ?").bind(user.id),
      ]);
    }
    return c.json({ user: await selectUser(c.env.DB, user.id) });
  })
  .post("/results", async (c) => {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const user = c.var.user!;
    // 同期中に AtCoder ID が変わっていたら、古い ID の結果は受け付けない
    if (!user.atcoderId || body?.atcoderId !== user.atcoderId) {
      return c.json({ error: "AtCoder ID が変更されたため、同期をやり直してください" }, 409);
    }
    const cursor = body.cursor;
    if (typeof cursor !== "number" || !Number.isInteger(cursor) || cursor < 0) return c.json({ error: "不正なリクエストです" }, 400);
    const results = parseResults(body.results);
    if (!results) return c.json({ error: "不正なリクエストです" }, 400);

    const db = c.env.DB;
    await batchAll(db, [
      ...results.map((r) =>
        db
          .prepare(
            `INSERT INTO user_task_results (user_id, task_id, has_ac, last_result, last_epoch) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (user_id, task_id) DO UPDATE SET
               has_ac = max(has_ac, excluded.has_ac),
               last_result = CASE WHEN excluded.last_epoch >= last_epoch AND excluded.last_result IS NOT NULL
                                  THEN excluded.last_result ELSE last_result END,
               last_epoch = max(last_epoch, excluded.last_epoch)`,
          )
          .bind(user.id, r.taskId, r.ac ? 1 : 0, r.lastResult, r.lastEpoch),
      ),
      db
        .prepare("UPDATE users SET submissions_cursor = max(submissions_cursor, ?), submissions_synced_at = datetime('now') WHERE id = ?")
        .bind(cursor, user.id),
    ]);
    const updated = await applyTaskResults(
      db,
      user.id,
      results.map((r) => r.taskId),
    );
    return c.json({ updated, user: await selectUser(db, user.id) });
  });
