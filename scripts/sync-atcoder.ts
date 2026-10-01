// AtCoder のコンテスト一覧・問題一覧・配点を取得して本番 D1 に書き込む。
// AtCoder は Cloudflare からのアクセスを拒否するので、手元の Mac で実行する（launchd で毎朝自動実行）。
//
//   npm run atcoder:sync                # 毎朝の取り込み（下記の順に、1 回あたり REQUEST_BUDGET アクセスまで）
//   npm run atcoder:sync abc400 arc190  # 指定したコンテストの問題一覧と配点を取り込む（取り込み済みなら上書き）
//                                       # コンテスト ID は大文字小文字を区別する（例: codequeen2026-final-Public）
//
// 毎朝の取り込みの優先順位:
//   1. アーカイブ 1 ページ目（直近の約 50 回）をコンテスト一覧に追加し、その問題一覧・配点を取り込む
//   2. アーカイブ 2 ページ目以降をコンテスト一覧に追加する（全ページ読み終えたら以降はスキップ）
//   3. 問題一覧が未取得のコンテストを新しい順に取り込む
//   4. 配点が未取得の問題を新しい順に取り込む
//
// AtCoder に負荷をかけないよう、ページ取得は REQUEST_INTERVAL_MS 間隔、1 回の実行で REQUEST_BUDGET 回まで。
// 問題文は AtCoder の著作物なので取得・保存しない。

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ORIGIN = "https://atcoder.jp";
const USER_AGENT = "AtCoderList-sync (+https://github.com/ryusuke920/AtCoderList)";
const REQUEST_INTERVAL_MS = 3000;
const REQUEST_BUDGET = 300;
const DB_NAME = "atcoder-list";
const ROOT = join(import.meta.dirname, "..");
const WRANGLER = join(ROOT, "node_modules", ".bin", "wrangler");

type Contest = { contestId: string; title: string; startAt: string; kind: "algorithm" | "heuristic" | null };
type Task = { taskId: string; label: string; title: string };

const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);

// ---- AtCoder へのアクセス ----

class BudgetExhausted extends Error {}
class HttpError extends Error {
  readonly status: number;
  constructor(status: number, path: string) {
    super(`GET ${path} -> ${status}`);
    this.status = status;
  }
}

let requestCount = 0;
let lastRequestAt = 0;
async function fetchPage(path: string): Promise<string> {
  if (requestCount >= REQUEST_BUDGET) throw new BudgetExhausted();
  const wait = lastRequestAt + REQUEST_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  requestCount++;
  lastRequestAt = Date.now();
  const res = await fetch(`${ORIGIN}${path}${path.includes("?") ? "&" : "?"}lang=ja`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new HttpError(res.status, path);
  return res.text();
}

// ---- HTML の読み取り ----

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** アーカイブページの各行（新しい順）と最終ページ番号 */
export function parseArchive(html: string): { contests: Contest[]; lastPage: number } {
  const contests: Contest[] = [];
  for (const [, row] of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const link = row.match(/<a href="\/contests\/([A-Za-z0-9_-]+)">([^<]*)<\/a>/);
    const time = row.match(/<time[^>]*>([^<]+)<\/time>/);
    if (!link || !time) continue;
    const kind = row.match(/title="(Algorithm|Heuristic)"/)?.[1].toLowerCase() as Contest["kind"] | undefined;
    contests.push({ contestId: link[1], title: decodeEntities(link[2].trim()), startAt: time[1].trim(), kind: kind ?? null });
  }
  const pages = [...html.matchAll(/archive\?[^"']*?page=(\d+)/g)].map((m) => Number(m[1]));
  return { contests, lastPage: Math.max(1, ...pages) };
}

/** 問題一覧ページの各行は「記号のリンク」「問題名のリンク」の順に同じ問題へのリンクを持つ */
export function parseTaskList(html: string, contestId: string): Task[] {
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

/** 問題ページの「配点 : <var>100</var> 点」。書かれていなければ null */
export function parseScore(html: string): number | null {
  const m = html.match(/配点\s*:\s*<var>\s*(\d+)\s*<\/var>/);
  return m ? Number(m[1]) : null;
}

// ---- D1 ----

function wrangler(args: string[]): string {
  return execFileSync(WRANGLER, ["d1", "execute", DB_NAME, "--remote", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function query<T>(sql: string): T[] {
  const [{ results }] = JSON.parse(wrangler(["--json", "--command", sql])) as [{ results: T[] }];
  return results;
}

const q = (s: string | null) => (s === null ? "NULL" : `'${s.replace(/'/g, "''")}'`);

/** 書き込みはまとめて流す。途中で止まっても取得済みの分は残るよう、適度にフラッシュする */
const pending: string[] = [];
function write(...statements: string[]) {
  pending.push(...statements);
  if (pending.length >= 200) flush();
}
function flush() {
  if (pending.length === 0) return;
  const dir = mkdtempSync(join(tmpdir(), "atcoder-sync-"));
  try {
    const file = join(dir, "sync.sql");
    writeFileSync(file, pending.join("\n"));
    wrangler(["--file", file, "--yes"]);
    pending.length = 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const upsertContest = (c: Contest) =>
  `INSERT INTO atcoder_contests (contest_id, title, start_at, kind) VALUES (${q(c.contestId)}, ${q(c.title)}, ${q(c.startAt)}, ${q(c.kind)}) ` +
  `ON CONFLICT (contest_id) DO UPDATE SET title = excluded.title, start_at = excluded.start_at, kind = excluded.kind;`;

const setState = (key: string, value: string) =>
  `INSERT INTO sync_state (key, value) VALUES (${q(key)}, ${q(value)}) ON CONFLICT (key) DO UPDATE SET value = excluded.value;`;

// ---- 取り込みの各ステップ ----

/** 問題一覧を取得して保存する。取得できなければ -1 にして再試行しない */
async function syncTaskList(contestId: string): Promise<Task[]> {
  let tasks: Task[] = [];
  try {
    tasks = parseTaskList(await fetchPage(`/contests/${contestId}/tasks`), contestId);
  } catch (e) {
    if (!(e instanceof HttpError && e.status === 404)) throw e;
  }
  // 行がなければ作る（引数で指定されたコンテストなど、アーカイブ経由でない場合）
  write(`INSERT OR IGNORE INTO atcoder_contests (contest_id) VALUES (${q(contestId)});`);
  write(
    ...tasks.map(
      (t, i) =>
        `INSERT INTO atcoder_tasks (task_id, contest_id, position, label, title) ` +
        `VALUES (${q(t.taskId)}, ${q(contestId)}, ${i}, ${q(t.label)}, ${q(t.title)}) ` +
        `ON CONFLICT (task_id) DO UPDATE SET position = excluded.position, label = excluded.label, title = excluded.title;`,
    ),
    `UPDATE atcoder_contests SET tasks_status = ${tasks.length > 0 ? 1 : -1}, fetched_at = datetime('now') WHERE contest_id = ${q(contestId)};`,
  );
  return tasks;
}

async function syncScore(contestId: string, taskId: string) {
  let score: number | null = null;
  try {
    score = parseScore(await fetchPage(`/contests/${contestId}/tasks/${taskId}`));
  } catch (e) {
    if (!(e instanceof HttpError && e.status === 404)) throw e;
  }
  write(`UPDATE atcoder_tasks SET score = ${score ?? "NULL"}, score_fetched = 1 WHERE task_id = ${q(taskId)};`);
}

async function syncContestFully(contestId: string) {
  const tasks = await syncTaskList(contestId);
  for (const t of tasks) await syncScore(contestId, t.taskId);
  log(`${contestId}: 問題 ${tasks.length} 問と配点を取り込みました`);
}

async function dailySync() {
  // 1. 直近のコンテスト
  const first = parseArchive(await fetchPage("/contests/archive"));
  write(...first.contests.map(upsertContest));
  flush();
  const recentIds = first.contests.map((c) => c.contestId);
  const recentPending = query<{ contest_id: string }>(
    `SELECT contest_id FROM atcoder_contests WHERE tasks_status = 0 AND contest_id IN (${recentIds.map(q).join(",")})`,
  );
  for (const { contest_id } of recentPending) await syncContestFully(contest_id);
  const recentScores = query<{ task_id: string; contest_id: string }>(
    `SELECT task_id, contest_id FROM atcoder_tasks WHERE score_fetched = 0 AND contest_id IN (${recentIds.map(q).join(",")})`,
  );
  for (const t of recentScores) await syncScore(t.contest_id, t.task_id);

  // 2. アーカイブの残りのページ
  const [state] = query<{ value: string }>("SELECT value FROM sync_state WHERE key = 'archive_page_done'");
  let pageDone = state ? Number(state.value) : 1;
  while (pageDone < first.lastPage) {
    const page = pageDone + 1;
    const { contests } = parseArchive(await fetchPage(`/contests/archive?page=${page}`));
    write(...contests.map(upsertContest), setState("archive_page_done", String(page)));
    pageDone = page;
    log(`アーカイブ ${page}/${first.lastPage} ページ: ${contests.length} 回をコンテスト一覧に追加`);
  }
  flush();

  // 3. 問題一覧が未取得のコンテスト
  const contests = query<{ contest_id: string }>(
    `SELECT contest_id FROM atcoder_contests WHERE tasks_status = 0 ORDER BY start_at DESC LIMIT ${REQUEST_BUDGET}`,
  );
  for (const { contest_id } of contests) {
    const tasks = await syncTaskList(contest_id);
    log(`${contest_id}: 問題 ${tasks.length} 問`);
  }
  flush();

  // 4. 配点が未取得の問題
  const tasks = query<{ task_id: string; contest_id: string }>(
    `SELECT t.task_id, t.contest_id FROM atcoder_tasks t JOIN atcoder_contests c ON c.contest_id = t.contest_id
      WHERE t.score_fetched = 0 ORDER BY c.start_at DESC, t.position LIMIT ${REQUEST_BUDGET}`,
  );
  for (const t of tasks) await syncScore(t.contest_id, t.task_id);
}

async function main() {
  const requested = process.argv.slice(2);
  try {
    if (requested.length > 0) {
      for (const id of requested) await syncContestFully(id);
    } else {
      await dailySync();
    }
  } catch (e) {
    if (!(e instanceof BudgetExhausted)) throw e;
    log(`今回のアクセス上限（${REQUEST_BUDGET} 回）に達したので、続きは次回に回します`);
  } finally {
    flush();
  }

  const [summary] = query<{ contests: number; listed: number; tasks: number; scored: number }>(
    `SELECT (SELECT count(*) FROM atcoder_contests) AS contests,
            (SELECT count(*) FROM atcoder_contests WHERE tasks_status <> 0) AS listed,
            (SELECT count(*) FROM atcoder_tasks) AS tasks,
            (SELECT count(*) FROM atcoder_tasks WHERE score_fetched = 1) AS scored`,
  );
  log(
    `完了（アクセス ${requestCount} 回）: コンテスト ${summary.contests} 回中 ${summary.listed} 回の問題一覧、` +
      `問題 ${summary.tasks} 問中 ${summary.scored} 問の配点を取り込み済み`,
  );
}

// テストなどから import されたときは実行しない
if (process.argv[1] === import.meta.filename) main().catch((e) => {
  // execFileSync の失敗は stderr に原因が入っている
  const stderr = (e as { stderr?: string }).stderr;
  log("失敗:", e instanceof Error ? e.message : e, stderr ? `\n${stderr}` : "");
  process.exit(1);
});
