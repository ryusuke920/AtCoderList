// AtCoder の問題一覧（問題名・配点）を取得して本番 D1 に書き込む。
// AtCoder は Cloudflare からのアクセスを拒否するので、手元の Mac で実行する（launchd で毎朝自動実行）。
//
//   npm run atcoder:sync              # アーカイブから未取り込みの ABC/ARC/AGC を新しい順に取り込む
//   npm run atcoder:sync abc400 arc190  # 指定したコンテストを取り込む（取り込み済みなら上書き）
//
// AtCoder に負荷をかけないよう、ページ取得の間隔を空け、1 回の実行で取り込むコンテスト数を絞る。
// 問題文は AtCoder の著作物なので取得・保存しない。

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ORIGIN = "https://atcoder.jp";
const USER_AGENT = "AtCoderList-sync (+https://github.com/ryusuke920/AtCoderList)";
const REQUEST_INTERVAL_MS = 3000;
const MAX_CONTESTS_PER_RUN = 3;
const TARGET = /^(abc|arc|agc)\d+$/;
const DB_NAME = "atcoder-list";
const WRANGLER = join(import.meta.dirname, "..", "node_modules", ".bin", "wrangler");

type Task = { taskId: string; label: string; title: string; score: number | null };

const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);

let lastRequestAt = 0;
async function fetchPage(path: string): Promise<string> {
  const wait = lastRequestAt + REQUEST_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  const res = await fetch(`${ORIGIN}${path}${path.includes("?") ? "&" : "?"}lang=ja`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
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

/** アーカイブページのコンテスト ID（新しい順） */
function parseArchive(html: string): string[] {
  const ids = [...html.matchAll(/<a href="\/contests\/([a-z0-9_-]+)">/g)].map((m) => m[1]);
  return [...new Set(ids)].filter((id) => TARGET.test(id));
}

/** 問題一覧ページの各行は「記号のリンク」「問題名のリンク」の順に同じ問題へのリンクを持つ */
function parseTaskList(html: string, contestId: string): Omit<Task, "score">[] {
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
function parseScore(html: string): number | null {
  const m = html.match(/配点\s*:\s*<var>\s*(\d+)\s*<\/var>/);
  return m ? Number(m[1]) : null;
}

function wrangler(args: string[]): string {
  return execFileSync(WRANGLER, ["d1", "execute", DB_NAME, "--remote", ...args], {
    cwd: join(import.meta.dirname, ".."),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function importedContestIds(): Set<string> {
  const out = wrangler(["--json", "--command", "SELECT contest_id FROM atcoder_contests"]);
  const [{ results }] = JSON.parse(out) as [{ results: { contest_id: string }[] }];
  return new Set(results.map((r) => r.contest_id));
}

const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;

function saveContest(contestId: string, tasks: Task[]) {
  // atcoder_tasks.contest_id は atcoder_contests を参照するので contest 行を先に入れる。
  // 問題ページの取得はすべて済んでから書き込むので、途中で失敗したコンテストは D1 に入らない
  const sql = [
    `INSERT INTO atcoder_contests (contest_id) VALUES (${sqlString(contestId)}) ` +
      `ON CONFLICT (contest_id) DO UPDATE SET fetched_at = datetime('now');`,
    ...tasks.map(
      (t, i) =>
        `INSERT INTO atcoder_tasks (task_id, contest_id, position, label, title, score, score_fetched) ` +
        `VALUES (${sqlString(t.taskId)}, ${sqlString(contestId)}, ${i}, ${sqlString(t.label)}, ${sqlString(t.title)}, ${t.score ?? "NULL"}, 1) ` +
        `ON CONFLICT (task_id) DO UPDATE SET position = excluded.position, label = excluded.label, ` +
        `title = excluded.title, score = excluded.score, score_fetched = 1;`,
    ),
  ];

  const dir = mkdtempSync(join(tmpdir(), "atcoder-sync-"));
  try {
    const file = join(dir, "sync.sql");
    writeFileSync(file, sql.join("\n"));
    wrangler(["--file", file, "--yes"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function syncContest(contestId: string) {
  const list = parseTaskList(await fetchPage(`/contests/${contestId}/tasks`), contestId);
  if (list.length === 0) throw new Error(`${contestId}: 問題一覧を読み取れませんでした`);
  const tasks: Task[] = [];
  for (const t of list) {
    tasks.push({ ...t, score: parseScore(await fetchPage(`/contests/${contestId}/tasks/${t.taskId}`)) });
  }
  saveContest(contestId, tasks);
  log(`${contestId}: ${tasks.length} 問を取り込みました`, tasks.map((t) => `${t.label}=${t.score ?? "-"}`).join(" "));
}

async function main() {
  const requested = process.argv.slice(2).map((a) => a.toLowerCase());
  let targets: string[];
  if (requested.length > 0) {
    targets = requested;
  } else {
    const imported = importedContestIds();
    targets = parseArchive(await fetchPage("/contests/archive"))
      .filter((id) => !imported.has(id))
      .slice(0, MAX_CONTESTS_PER_RUN);
  }

  if (targets.length === 0) {
    log("新しいコンテストはありません");
    return;
  }
  for (const id of targets) await syncContest(id);
}

main().catch((e) => {
  // execFileSync の失敗は stderr に原因が入っている
  const stderr = (e as { stderr?: string }).stderr;
  log("失敗:", e instanceof Error ? e.message : e, stderr ? `\n${stderr}` : "");
  process.exit(1);
});
