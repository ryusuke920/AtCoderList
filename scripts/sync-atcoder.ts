// AtCoder のコンテスト一覧・問題一覧・配点を取得して本番 D1 に書き込む。
// AtCoder は Cloudflare からのアクセスを拒否するので、手元の Mac で実行する（launchd で毎朝自動実行）。
//
//   npm run atcoder:sync                # 毎朝の取り込み（下記の順に、1 回あたり 300 アクセスまで、3 秒間隔）
//   npm run atcoder:sync -- --all       # 上限なしで最後まで取り込む（過去分の一括取り込み用）
//   npm run atcoder:sync abc400 arc190  # 指定したコンテストの問題一覧と配点を取り込む（取り込み済みなら上書き）
//                                       # コンテスト ID は大文字小文字を区別する（例: codequeen2026-final-Public）
//
// 毎朝の取り込みの優先順位:
//   1. アーカイブ 1 ページ目（直近の約 50 回）をコンテスト一覧に追加し、その問題一覧・配点を取り込む
//   2. アーカイブ 2 ページ目以降をコンテスト一覧に追加する（全ページ読み終えたら以降はスキップ）
//   3. 問題一覧と配点が未取得のコンテストを新しい順に取り込む
//   4. 問題一覧はあるが配点が未取得のコンテストの配点を取り込む
//
// 1 コンテストあたり 2 アクセス: 問題一覧ページ（問題 ID・記号・問題名）と、
// 全問題を 1 ページにまとめた印刷用ページ tasks_print（記号ごとの配点）。
//
// AtCoder に負荷をかけないよう、ページ取得の間隔を空け、1 回の実行のアクセス数に上限を設ける。
// 429・5xx・通信エラーは待ってから再試行し、それでも駄目なら止める（取り込み済みの分は残るので再実行で続きから）。
// 同時に 2 つ動かないようロックファイルを使う（一括取り込み中は毎朝の実行をスキップする）。
// 問題文は AtCoder の著作物なので取得・保存しない。

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ORIGIN = "https://atcoder.jp";
const USER_AGENT = "AtCoderList-sync (+https://github.com/ryusuke920/AtCoderList)";
const ALL = process.argv.includes("--all");
const REQUEST_INTERVAL_MS = 3000;
const REQUEST_BUDGET = ALL ? Infinity : 300;
const RETRY_WAITS_MS = [60_000, 120_000, 300_000];
// launchd とシェルで TMPDIR が違うことがあるので固定の場所に置く
const LOCK_FILE = join(homedir(), "Library", "Caches", "atcoder-list-sync.lock");
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
async function fetchOnce(path: string): Promise<string> {
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

const isRetryable = (e: unknown) =>
  e instanceof HttpError ? e.status === 429 || e.status >= 500 : !(e instanceof BudgetExhausted);

async function fetchPage(path: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchOnce(path);
    } catch (e) {
      if (!isRetryable(e) || attempt >= RETRY_WAITS_MS.length) throw e;
      log(`${e instanceof Error ? e.message : e}。${RETRY_WAITS_MS[attempt] / 1000} 秒待って再試行します`);
      await sleep(RETRY_WAITS_MS[attempt]);
    }
  }
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

/** 問題文中の最初の「配点 : <var>100</var> 点」。書かれていなければ null */
export function parseScore(html: string): number | null {
  const m = html.match(/配点\s*:\s*<var>\s*(\d+)\s*<\/var>/);
  return m ? Number(m[1]) : null;
}

/** 印刷用ページ（tasks_print）を「A - 問題名」の見出しで区切り、記号ごとの配点を読む */
export function parsePrintScores(html: string): Map<string, number | null> {
  const scores = new Map<string, number | null>();
  const sections = html.split('<span class="h2">').slice(1);
  for (const section of sections) {
    const label = section.match(/^\s*([^<]+?)\s+-\s/)?.[1];
    if (label && !scores.has(label)) scores.set(decodeEntities(label), parseScore(section));
  }
  return scores;
}

// ---- D1 ----

const run = (args: string[]) =>
  execFileSync(WRANGLER, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });

// wrangler login のトークンは 1 時間ほどで切れ、d1 execute は自動で更新してくれない（code 10000 / 7403 になる）。
// whoami を実行すると更新されるので、20 分おきに先回りして更新し、それでも認証エラーなら更新して 1 回やり直す
const TOKEN_REFRESH_INTERVAL_MS = 20 * 60 * 1000;
let tokenRefreshedAt = 0;
function refreshToken() {
  run(["whoami"]);
  tokenRefreshedAt = Date.now();
}
const isAuthError = (e: unknown) => /code: (10000|7403)\b/.test(String((e as { stderr?: string }).stderr));

function wrangler(args: string[]): string {
  const command = ["d1", "execute", DB_NAME, "--remote", ...args];
  if (Date.now() - tokenRefreshedAt > TOKEN_REFRESH_INTERVAL_MS) refreshToken();
  try {
    return run(command);
  } catch (e) {
    if (!isAuthError(e)) throw e;
    log("Cloudflare の認証エラー。トークンを更新して再試行します");
    refreshToken();
    return run(command);
  }
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
// --file（D1 の import API）はトークン切れのまま失敗したことがあるので、読み取りと同じ --command で書き込む
function flush() {
  if (pending.length === 0) return;
  wrangler(["--command", pending.join("\n"), "--yes"]);
  pending.length = 0;
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
        `ON CONFLICT (contest_id, task_id) DO UPDATE SET position = excluded.position, label = excluded.label, title = excluded.title;`,
    ),
    `UPDATE atcoder_contests SET tasks_status = ${tasks.length > 0 ? 1 : -1}, fetched_at = datetime('now') WHERE contest_id = ${q(contestId)};`,
  );
  return tasks;
}

/** 印刷用ページから配点を取り込む。見つからなかった問題も配点なし（NULL）として取得済みにする */
async function syncScores(contestId: string) {
  let scores = new Map<string, number | null>();
  try {
    scores = parsePrintScores(await fetchPage(`/contests/${contestId}/tasks_print`));
  } catch (e) {
    if (!(e instanceof HttpError && e.status === 404)) throw e;
  }
  write(
    ...[...scores].map(
      ([label, score]) =>
        `UPDATE atcoder_tasks SET score = ${score ?? "NULL"}, score_fetched = 1 WHERE contest_id = ${q(contestId)} AND label = ${q(label)};`,
    ),
    `UPDATE atcoder_tasks SET score_fetched = 1 WHERE contest_id = ${q(contestId)} AND score_fetched = 0;`,
  );
}

async function syncContest(contestId: string) {
  const tasks = await syncTaskList(contestId);
  if (tasks.length > 0) await syncScores(contestId);
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
  for (const { contest_id } of recentPending) await syncContest(contest_id);
  const recentScores = query<{ contest_id: string }>(
    `SELECT DISTINCT contest_id FROM atcoder_tasks WHERE score_fetched = 0 AND contest_id IN (${recentIds.map(q).join(",")})`,
  );
  for (const { contest_id } of recentScores) await syncScores(contest_id);

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

  // 3. 問題一覧と配点が未取得のコンテスト（--all のときは尽きるまで 200 件ずつ）
  for (;;) {
    const contests = query<{ contest_id: string }>(
      `SELECT contest_id FROM atcoder_contests WHERE tasks_status = 0 ORDER BY start_at DESC LIMIT 200`,
    );
    if (contests.length === 0) break;
    for (const { contest_id } of contests) await syncContest(contest_id);
    flush();
  }

  // 4. 問題一覧はあるが配点が未取得のコンテスト
  for (;;) {
    const contests = query<{ contest_id: string }>(
      `SELECT DISTINCT t.contest_id FROM atcoder_tasks t JOIN atcoder_contests c ON c.contest_id = t.contest_id
        WHERE t.score_fetched = 0 ORDER BY c.start_at DESC LIMIT 200`,
    );
    if (contests.length === 0) break;
    for (const { contest_id } of contests) {
      await syncScores(contest_id);
      log(`${contest_id}: 配点を取り込みました`);
    }
    flush();
  }
}

/** 別の実行が動いていれば false。動いていなければロックを取って true */
function acquireLock(): boolean {
  try {
    const pid = Number(readFileSync(LOCK_FILE, "utf8"));
    process.kill(pid, 0); // 生きていれば例外にならない
    return false;
  } catch {
    writeFileSync(LOCK_FILE, String(process.pid));
    return true;
  }
}

async function main() {
  const requested = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!acquireLock()) {
    log("別の取り込みが実行中なので、今回はスキップします");
    return;
  }
  try {
    if (requested.length > 0) {
      for (const id of requested) await syncContest(id);
    } else {
      await dailySync();
    }
  } catch (e) {
    if (!(e instanceof BudgetExhausted)) throw e;
    log(`今回のアクセス上限（${REQUEST_BUDGET} 回）に達したので、続きは次回に回します`);
  } finally {
    flush();
    rmSync(LOCK_FILE, { force: true });
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
