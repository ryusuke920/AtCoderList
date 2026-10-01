// フロントエンドと Worker の両方で使うドメイン定義

export const DIFFICULTIES = [
  { value: "unset", label: "未設定", color: "#9aa5b1" },
  { value: "gray", label: "灰", color: "#808080" },
  { value: "brown", label: "茶", color: "#804000" },
  { value: "green", label: "緑", color: "#008000" },
  { value: "cyan", label: "水", color: "#00c0c0" },
  { value: "blue", label: "青", color: "#0000ff" },
  { value: "yellow", label: "黄", color: "#c0c000" },
  { value: "orange", label: "橙", color: "#ff8000" },
  { value: "red", label: "赤", color: "#ff0000" },
] as const;
export type Difficulty = (typeof DIFFICULTIES)[number]["value"];

export const STATUSES = [
  { value: "todo", label: "未提出", color: "#f3a6d8" },
  { value: "AC", label: "AC", color: "#5cb85c" },
  { value: "WA", label: "WA", color: "#f0ad4e" },
  { value: "TLE", label: "TLE", color: "#f0ad4e" },
  { value: "MLE", label: "MLE", color: "#f0ad4e" },
  { value: "RE", label: "RE", color: "#f0ad4e" },
  { value: "CE", label: "CE", color: "#f0ad4e" },
] as const;
export type Status = (typeof STATUSES)[number]["value"];

export const TAG_GROUPS: { name: string; tags: string[] }[] = [
  { name: "探索", tags: ["全探索", "二分探索", "深さ優先探索", "幅優先探索", "bit全探索", "順列全探索"] },
  { name: "貪欲", tags: ["貪欲法"] },
  { name: "文字列", tags: ["文字列処理", "ローリングハッシュ"] },
  { name: "数学", tags: ["整数", "組み合わせ", "確率", "期待値"] },
  {
    name: "テクニック",
    tags: ["累積和", "いもす法", "尺取り法", "半分全列挙", "平方分割", "分割統治", "ダブリング"],
  },
  { name: "グラフ", tags: ["ダイクストラ法", "ワーシャル・フロイド法", "最小全域木", "オイラー閉路"] },
  { name: "動的計画法", tags: ["DP", "木DP", "区間DP", "bitDP", "桁DP", "インラインDP"] },
  {
    name: "データ構造",
    tags: ["set", "priority_queue", "Union-Find", "Segment Tree", "Binary Indexed Tree"],
  },
  { name: "ゲーム", tags: ["Nim", "Grundy数", "Minimax法", "Alpha-Beta法"] },
  { name: "フロー", tags: ["最大流", "最小費用流", "二部マッチング", "最大安定集合"] },
  { name: "幾何", tags: ["凸包", "線分交差判定", "反転幾何", "平面走査法"] },
  { name: "その他", tags: ["インタラクティブ", "マラソン", "その他"] },
];

export type Problem = {
  id: number;
  title: string;
  url: string;
  difficulty: Difficulty;
  status: Status;
  memo: string;
  score: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type ProblemInput = Pick<Problem, "title" | "url" | "difficulty" | "status" | "memo" | "score" | "tags">;

export type User = { id: number; username: string };

export const USERNAME_RULE = { pattern: /^[A-Za-z0-9_\-]{3,20}$/, message: "ユーザー名は半角英数字・_・- の3〜20文字にしてください" };
export const PASSWORD_RULE = { min: 8, max: 128 };

export function validateCredentials(raw: unknown): { ok: true; username: string; password: string } | { ok: false; error: string } {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const username = typeof r.username === "string" ? r.username.trim() : "";
  const password = typeof r.password === "string" ? r.password : "";
  if (!USERNAME_RULE.pattern.test(username)) return { ok: false, error: USERNAME_RULE.message };
  if (password.length < PASSWORD_RULE.min || password.length > PASSWORD_RULE.max)
    return { ok: false, error: `パスワードは${PASSWORD_RULE.min}〜${PASSWORD_RULE.max}文字にしてください` };
  return { ok: true, username, password };
}

export const LIMITS = { title: 200, url: 500, memo: 2000, tags: 20, tag: 40, score: 100_000 } as const;

/** 入力を検証して正規化する。不正なら日本語のエラーメッセージを返す */
export function validateProblemInput(raw: unknown): { ok: true; value: ProblemInput } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "不正なリクエストです" };
  const r = raw as Record<string, unknown>;

  const title = typeof r.title === "string" ? r.title.trim() : "";
  const url = typeof r.url === "string" ? r.url.trim() : "";
  const memo = typeof r.memo === "string" ? r.memo.trim() : "";
  const difficulty = r.difficulty ?? "unset";
  const status = r.status ?? "todo";
  const score = r.score === undefined || r.score === null || r.score === "" ? null : Number(r.score);
  const tags = Array.isArray(r.tags) ? [...new Set(r.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean))] : [];

  if (!title) return { ok: false, error: "問題名を入力してください" };
  if (title.length > LIMITS.title) return { ok: false, error: `問題名は${LIMITS.title}文字以内にしてください` };
  if (!/^https?:\/\/\S+$/.test(url) || url.length > LIMITS.url) return { ok: false, error: "URL が正しくありません" };
  if (memo.length > LIMITS.memo) return { ok: false, error: `メモは${LIMITS.memo}文字以内にしてください` };
  if (!DIFFICULTIES.some((d) => d.value === difficulty)) return { ok: false, error: "Difficulty が不正です" };
  if (!STATUSES.some((s) => s.value === status)) return { ok: false, error: "状態が不正です" };
  if (score !== null && !(Number.isInteger(score) && score >= 0 && score <= LIMITS.score))
    return { ok: false, error: "配点は0以上の整数にしてください" };
  if (tags.length > LIMITS.tags || tags.some((t) => t.length > LIMITS.tag)) return { ok: false, error: "タグが多すぎるか長すぎます" };

  return { ok: true, value: { title, url, memo, score, difficulty: difficulty as Difficulty, status: status as Status, tags } };
}

/** AtCoder の問題 URL から「ABC184 C」のような問題名の候補を作る */
export function guessTitleFromUrl(url: string): string | null {
  const m = url.match(/atcoder\.jp\/contests\/([^/]+)\/tasks\/([^/?#]+)/);
  if (!m) return null;
  const [, contest, task] = m;
  const suffix = task.startsWith(`${contest}_`) ? task.slice(contest.length + 1) : task;
  return `${contest.toUpperCase()} ${suffix.toUpperCase()}`;
}

/** AtCoder から取得した問題（一覧の 1 行） */
export type AtCoderTask = {
  taskId: string;
  label: string;
  title: string;
  url: string;
  /** 未取得なら undefined、配点が書かれていない問題なら null */
  score?: number | null;
};

/** 「ABC400」「abc400」やコンテスト / 問題の URL からコンテスト ID を取り出す */
export function parseContestId(input: string): string | null {
  const text = input.trim();
  const fromUrl = text.match(/atcoder\.jp\/contests\/([^/?#]+)/);
  const id = (fromUrl ? fromUrl[1] : text).toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{1,39}$/.test(id) ? id : null;
}
