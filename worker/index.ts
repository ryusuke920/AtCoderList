import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { validateProblemInput, type Problem } from "../shared/domain";
import { atcoderRoutes } from "./atcoder";
import { authRoutes, loadUser, purgeExpiredSessions, requireUser } from "./auth";
import type { AppEnv, Bindings } from "./types";

type ProblemRow = Omit<Problem, "tags"> & { tags: string };

const SELECT_PROBLEMS = `
  SELECT p.id, p.title, p.url, p.difficulty, p.status, p.memo, p.score,
         p.created_at AS createdAt, p.updated_at AS updatedAt,
         COALESCE((SELECT json_group_array(tag) FROM problem_tags t WHERE t.problem_id = p.id), '[]') AS tags
    FROM problems p`;

const toProblem = (row: ProblemRow): Problem => ({ ...row, tags: JSON.parse(row.tags) });

/**
 * タグを差し替える文。対象の problem_id は自分の問題に絞ったサブクエリで引くので、
 * 問題の INSERT/UPDATE と同じ batch（= 1 トランザクション）に入れられ、他人の問題にも触れない
 */
function replaceTagStatements(db: D1Database, target: { where: string; params: unknown[] }, tags: string[]) {
  const select = `SELECT id FROM problems WHERE ${target.where}`;
  return [
    db.prepare(`DELETE FROM problem_tags WHERE problem_id = (${select})`).bind(...target.params),
    ...tags.map((tag) =>
      db.prepare(`INSERT INTO problem_tags (problem_id, tag) SELECT id, ? FROM problems WHERE ${target.where}`).bind(tag, ...target.params),
    ),
  ];
}

const isUniqueViolation = (e: unknown) => e instanceof Error && e.message.includes("UNIQUE constraint failed");

const api = new Hono<AppEnv>()
  .get("/me", (c) => c.json({ user: c.var.user }))
  .use("/problems/*", requireUser)
  .get("/problems", async (c) => {
    const { results } = await c.env.DB.prepare(`${SELECT_PROBLEMS} WHERE p.user_id = ? ORDER BY p.updated_at DESC, p.id DESC`)
      .bind(c.var.user!.id)
      .all<ProblemRow>();
    return c.json({ problems: results.map(toProblem) });
  })
  .post("/problems", async (c) => {
    const parsed = validateProblemInput(await c.req.json().catch(() => null));
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const p = parsed.value;
    const db = c.env.DB;
    const userId = c.var.user!.id;
    try {
      const [inserted] = await db.batch<{ id: number }>([
        db
          .prepare("INSERT INTO problems (user_id, title, url, difficulty, status, memo, score) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id")
          .bind(userId, p.title, p.url, p.difficulty, p.status, p.memo, p.score),
        ...replaceTagStatements(db, { where: "user_id = ? AND url = ?", params: [userId, p.url] }, p.tags),
      ]);
      const created = await db.prepare(`${SELECT_PROBLEMS} WHERE p.id = ?`).bind(inserted.results[0].id).first<ProblemRow>();
      return c.json({ problem: toProblem(created!) }, 201);
    } catch (e) {
      if (isUniqueViolation(e)) return c.json({ error: "この問題は既に登録されています" }, 409);
      throw e;
    }
  })
  .put("/problems/:id{[0-9]+}", async (c) => {
    const id = Number(c.req.param("id"));
    const parsed = validateProblemInput(await c.req.json().catch(() => null));
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const p = parsed.value;
    const db = c.env.DB;
    const userId = c.var.user!.id;
    try {
      // user_id 条件で他人の問題を書き換えられないようにする
      const [updated] = await db.batch([
        db
          .prepare(
            `UPDATE problems SET title = ?, url = ?, difficulty = ?, status = ?, memo = ?, score = ?, updated_at = datetime('now')
              WHERE id = ? AND user_id = ?`,
          )
          .bind(p.title, p.url, p.difficulty, p.status, p.memo, p.score, id, userId),
        ...replaceTagStatements(db, { where: "id = ? AND user_id = ?", params: [id, userId] }, p.tags),
      ]);
      if (updated.meta.changes === 0) return c.json({ error: "問題が見つかりません" }, 404);
      const row = await db.prepare(`${SELECT_PROBLEMS} WHERE p.id = ?`).bind(id).first<ProblemRow>();
      return c.json({ problem: toProblem(row!) });
    } catch (e) {
      if (isUniqueViolation(e)) return c.json({ error: "この URL の問題は既に登録されています" }, 409);
      throw e;
    }
  })
  .delete("/problems/:id{[0-9]+}", async (c) => {
    const { meta } = await c.env.DB.prepare("DELETE FROM problems WHERE id = ? AND user_id = ?")
      .bind(Number(c.req.param("id")), c.var.user!.id)
      .run();
    if (meta.changes === 0) return c.json({ error: "問題が見つかりません" }, 404);
    return c.body(null, 204);
  });

const app = new Hono<AppEnv>()
  .use(csrf())
  .use(loadUser)
  .route("/auth", authRoutes)
  .route("/api/atcoder", atcoderRoutes)
  .route("/api", api);

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: "サーバーエラーが発生しました" }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event, env) {
    await purgeExpiredSessions(env.DB);
  },
} satisfies ExportedHandler<Bindings>;
