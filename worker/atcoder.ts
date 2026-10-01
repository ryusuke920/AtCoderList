// AtCoder の問題一覧（URL・問題名・配点）を返す。
// AtCoder は Cloudflare からのアクセスを 403 で拒否するため、Worker からは取得しない。
// データは手元の Mac で動く scripts/sync-atcoder.ts が D1 に書き込んだものだけを使う。

import { Hono } from "hono";
import { parseContestId, type AtCoderTask } from "../shared/domain";
import { requireUser } from "./auth";
import type { AppEnv } from "./types";

type TaskRow = { taskId: string; label: string; title: string; score: number | null };

export const atcoderRoutes = new Hono<AppEnv>()
  .use("*", requireUser)
  .get("/contests/:contestId/tasks", async (c) => {
    const contestId = parseContestId(c.req.param("contestId"));
    if (!contestId) return c.json({ error: "コンテスト ID が正しくありません（例: abc400）" }, 400);

    const { results } = await c.env.DB.prepare(
      "SELECT task_id AS taskId, label, title, score FROM atcoder_tasks WHERE contest_id = ? ORDER BY position",
    )
      .bind(contestId)
      .all<TaskRow>();
    if (results.length === 0) {
      return c.json({ error: "このコンテストはまだ取り込まれていません。URL と問題名を手で入力してください" }, 404);
    }

    const tasks: AtCoderTask[] = results.map((r) => ({
      ...r,
      url: `https://atcoder.jp/contests/${contestId}/tasks/${r.taskId}`,
    }));
    return c.json({ contestId, tasks });
  });
