// AtCoder Problems の提出 API（https://github.com/kenkoooo/AtCoderProblems/blob/master/doc/api.md）から
// 自分の提出を読み、問題ごとに「AC したか」「最後の結果」を集計してサーバーに送る。
//
// API の注意書きに従い、アクセスの間隔を 1 秒以上空ける（タブをまたいでも守るよう localStorage に記録）。
// 前回の続き（from_second）から読み、1 回の同期で読むのは MAX_PAGES ページまで。

import { MAX_TASK_RESULTS_PER_REQUEST, SYNCABLE_RESULTS, type Status, type TaskResult, type User } from "../shared/domain";
import { api } from "./api";

const ENDPOINT = "https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions";
const MIN_INTERVAL_MS = 1100;
const PAGE_SIZE = 500;
const MAX_PAGES = 20;
const LAST_ACCESS_KEY = "atcoder-problems-last-access";

type Submission = { epoch_second: number; problem_id: string; result: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readLastAccess(): number {
  try {
    return Number(localStorage.getItem(LAST_ACCESS_KEY)) || 0;
  } catch {
    return 0;
  }
}
function writeLastAccess(t: number) {
  try {
    localStorage.setItem(LAST_ACCESS_KEY, String(t));
  } catch {
    // 保存できなくてもこのタブ内の間隔は lastAccess で守られる
  }
}

let lastAccess = 0;
async function fetchPage(atcoderId: string, from: number): Promise<Submission[]> {
  const wait = Math.max(lastAccess, readLastAccess()) + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastAccess = Date.now();
  writeLastAccess(lastAccess);
  const res = await fetch(`${ENDPOINT}?user=${encodeURIComponent(atcoderId)}&from_second=${from}`);
  if (!res.ok) throw new Error(`AtCoder Problems から提出を取得できませんでした (${res.status})`);
  return res.json();
}

/** ジャッジ中など、まだ結果が確定していない提出か */
const isPending = (result: string) => result === "WJ" || result === "WR" || result.includes("/");

export type SyncOutcome = { updated: number; user: User; more: boolean };

export async function syncSubmissions(user: User): Promise<SyncOutcome> {
  const atcoderId = user.atcoderId;
  if (!atcoderId) throw new Error("AtCoder ID が設定されていません");

  const results = new Map<string, TaskResult>();
  let from = user.submissionsCursor;
  let nextCursor = from;
  let more = false;

  for (let page = 0; ; page++) {
    const submissions = await fetchPage(atcoderId, from);
    let pendingFrom: number | null = null;
    for (const s of submissions) {
      if (isPending(s.result)) {
        // 確定前の提出は次回もう一度読む
        pendingFrom = pendingFrom === null ? s.epoch_second : Math.min(pendingFrom, s.epoch_second);
        continue;
      }
      const r = results.get(s.problem_id) ?? { taskId: s.problem_id, ac: false, lastResult: null, lastEpoch: 0 };
      if (s.result === "AC") r.ac = true;
      if (SYNCABLE_RESULTS.includes(s.result as Status) && s.epoch_second >= r.lastEpoch) {
        r.lastResult = s.result as Status;
        r.lastEpoch = s.epoch_second;
      }
      results.set(s.problem_id, r);
    }
    if (submissions.length > 0) from = Math.max(...submissions.map((s) => s.epoch_second)) + 1;
    nextCursor = pendingFrom !== null ? Math.min(pendingFrom, from) : from;
    if (pendingFrom !== null || submissions.length < PAGE_SIZE) break;
    if (page + 1 >= MAX_PAGES) {
      more = true;
      break;
    }
  }

  // サーバーには問題ごとのまとめだけを送る。カーソルは最後の送信でだけ進める
  const all = [...results.values()];
  let outcome: SyncOutcome = { updated: 0, user, more };
  for (let i = 0; i === 0 || i < all.length; i += MAX_TASK_RESULTS_PER_REQUEST) {
    const chunk = all.slice(i, i + MAX_TASK_RESULTS_PER_REQUEST);
    const isLast = i + MAX_TASK_RESULTS_PER_REQUEST >= all.length;
    const res = await api.postTaskResults(atcoderId, isLast ? nextCursor : user.submissionsCursor, chunk);
    outcome = { updated: outcome.updated + res.updated, user: res.user, more };
  }
  return outcome;
}
