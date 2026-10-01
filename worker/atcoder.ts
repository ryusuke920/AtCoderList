// AtCoder の問題一覧・配点の取得。公式 API はないので公開ページの HTML を読む。
// AtCoder に負荷をかけないよう、取得結果は D1 にキャッシュして同じページは二度取りにいかない。
// 問題文は AtCoder の著作物なので取得・保存しない。

import { Hono } from "hono";
import { parseContestId, type AtCoderTask } from "../shared/domain";
import { requireUser } from "./auth";
import type { AppEnv } from "./types";

const ORIGIN = "https://atcoder.jp";
const USER_AGENT = "AtCoderList (+https://github.com/ryusuke920/AtCoderList)";

class AtCoderError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 502 | 503,
  ) {
    super(message);
  }
}

async function fetchPage(path: string): Promise<string> {
  const res = await fetch(`${ORIGIN}${path}?lang=ja`, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 404) throw new AtCoderError("AtCoder にそのコンテスト / 問題が見つかりませんでした", 404);
  if (res.status === 429) throw new AtCoderError("AtCoder が混み合っています。少し待つか、手で入力してください", 503);
  if (!res.ok) throw new AtCoderError(`AtCoder からの取得に失敗しました (${res.status})`, 502);
  return res.text();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** 問題一覧ページの各行は「記号のリンク」「問題名のリンク」の順に同じ問題へのリンクを持つ */
export function parseTaskList(html: string, contestId: string): Omit<AtCoderTask, "url" | "score">[] {
  const linkRe = new RegExp(`<a href="/contests/${contestId}/tasks/([^"/?#]+)">([^<]*)</a>`, "g");
  const tasks = new Map<string, { label?: string; title?: string }>();
  for (const [, taskId, text] of html.matchAll(linkRe)) {
    const t = tasks.get(taskId) ?? {};
    if (t.label === undefined) t.label = decodeEntities(text.trim());
    else if (t.title === undefined) t.title = decodeEntities(text.trim());
    tasks.set(taskId, t);
  }
  return [...tasks]
    .filter(([, t]) => t.label && t.title)
    .map(([taskId, t]) => ({ taskId, label: t.label!, title: t.title! }));
}

/** 問題ページの「配点 : <var>100</var> 点」を読む。書かれていなければ null */
export function parseScore(html: string): number | null {
  const m = html.match(/配点\s*:\s*<var>\s*(\d+)\s*<\/var>/);
  return m ? Number(m[1]) : null;
}

const taskUrl = (contestId: string, taskId: string) => `${ORIGIN}/contests/${contestId}/tasks/${taskId}`;

type TaskRow = { taskId: string; label: string; title: string; score: number | null; scoreFetched: number };

const toTask = (contestId: string, r: TaskRow): AtCoderTask => ({
  taskId: r.taskId,
  label: r.label,
  title: r.title,
  url: taskUrl(contestId, r.taskId),
  ...(r.scoreFetched ? { score: r.score } : {}),
});

async function loadTasks(db: D1Database, contestId: string) {
  const { results } = await db
    .prepare(
      `SELECT task_id AS taskId, label, title, score, score_fetched AS scoreFetched
         FROM atcoder_tasks WHERE contest_id = ? ORDER BY position`,
    )
    .bind(contestId)
    .all<TaskRow>();
  return results;
}

export const atcoderRoutes = new Hono<AppEnv>()
  // 外部サイトへのプロキシとして悪用されないよう、ログインユーザーだけに使わせる
  .use("*", requireUser)
  .get("/contests/:contestId/tasks", async (c) => {
    const contestId = parseContestId(c.req.param("contestId"));
    if (!contestId) return c.json({ error: "コンテスト ID が正しくありません（例: abc400）" }, 400);
    const db = c.env.DB;

    let rows = await loadTasks(db, contestId);
    if (rows.length === 0) {
      try {
        const tasks = parseTaskList(await fetchPage(`/contests/${contestId}/tasks`), contestId);
        // 開催前などで問題が見えないときはキャッシュしない
        if (tasks.length === 0) return c.json({ error: "問題一覧を読み取れませんでした。手で入力してください" }, 404);
        await db.batch([
          db.prepare("INSERT OR IGNORE INTO atcoder_contests (contest_id) VALUES (?)").bind(contestId),
          ...tasks.map((t, i) =>
            db
              .prepare("INSERT OR IGNORE INTO atcoder_tasks (task_id, contest_id, position, label, title) VALUES (?, ?, ?, ?, ?)")
              .bind(t.taskId, contestId, i, t.label, t.title),
          ),
        ]);
        rows = await loadTasks(db, contestId);
      } catch (e) {
        if (e instanceof AtCoderError) return c.json({ error: e.message }, e.status);
        throw e;
      }
    }
    return c.json({ contestId, tasks: rows.map((r) => toTask(contestId, r)) });
  })
  .get("/contests/:contestId/tasks/:taskId", async (c) => {
    const contestId = parseContestId(c.req.param("contestId"));
    const taskId = c.req.param("taskId");
    if (!contestId) return c.json({ error: "コンテスト ID が正しくありません" }, 400);
    const db = c.env.DB;

    const row = (await loadTasks(db, contestId)).find((r) => r.taskId === taskId);
    // 一覧で取得済みの問題だけを対象にする（任意のパスを AtCoder に投げさせない）
    if (!row) return c.json({ error: "先にコンテストの問題一覧を読み込んでください" }, 404);

    if (!row.scoreFetched) {
      try {
        row.score = parseScore(await fetchPage(`/contests/${contestId}/tasks/${taskId}`));
        row.scoreFetched = 1;
        await db.prepare("UPDATE atcoder_tasks SET score = ?, score_fetched = 1 WHERE task_id = ?").bind(row.score, taskId).run();
      } catch (e) {
        if (e instanceof AtCoderError) return c.json({ error: e.message }, e.status);
        throw e;
      }
    }
    return c.json({ task: toTask(contestId, row) });
  });
