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

// 既存の問題に付いているタグ名と一致させるため、一度追加したタグの名前は変えないこと
export const TAG_GROUPS: { name: string; tags: string[] }[] = [
  {
    name: "探索",
    tags: ["全探索", "bit全探索", "順列全探索", "二分探索", "答えで二分探索", "三分探索", "深さ優先探索", "幅優先探索", "01-BFS", "メモ化再帰", "枝刈り", "半分全列挙"],
  },
  { name: "貪欲", tags: ["貪欲法", "区間スケジューリング", "交換論法", "後ろから考える"] },
  {
    name: "文字列",
    tags: ["文字列処理", "ローリングハッシュ", "Z-algorithm", "KMP", "Manacher", "Suffix Array", "LCP", "Trie", "Aho-Corasick", "回文", "ランレングス圧縮"],
  },
  {
    name: "整数論",
    tags: ["整数", "素数判定", "素因数分解", "エラトステネスの篩", "約数列挙", "GCD・LCM", "拡張ユークリッド", "mod逆元", "繰り返し二乗法", "中国剰余定理", "オイラーのφ関数", "メビウス関数"],
  },
  {
    name: "数え上げ・確率",
    tags: ["組み合わせ", "二項係数", "包除原理", "数え上げ", "カタラン数", "確率", "期待値", "期待値の線形性", "主客転倒", "寄与で考える"],
  },
  {
    name: "代数",
    tags: ["行列累乗", "線形代数", "XOR基底", "FFT・NTT", "畳み込み", "形式的冪級数", "bit演算"],
  },
  {
    name: "テクニック",
    tags: ["累積和", "二次元累積和", "いもす法", "尺取り法", "座標圧縮", "平方分割", "分割統治", "ダブリング", "Mo's algorithm", "スライド最小値", "差分を考える", "前計算", "鳩の巣原理"],
  },
  {
    name: "グラフ",
    tags: ["ダイクストラ法", "ベルマンフォード法", "ワーシャル・フロイド法", "最小全域木", "トポロジカルソート", "強連結成分分解", "二部グラフ判定", "閉路検出", "Functional Graph", "オイラー閉路", "橋・関節点", "2-SAT", "グリッドグラフ", "頂点倍化"],
  },
  {
    name: "木",
    tags: ["木の直径", "LCA", "オイラーツアー", "HL分解", "重心分解", "全方位木DP", "マージテク"],
  },
  {
    name: "動的計画法",
    tags: ["DP", "ナップサックDP", "部分和DP", "LIS", "LCS・編集距離", "区間DP", "bitDP", "桁DP", "木DP", "確率・期待値DP", "挿入DP", "インラインDP", "累積和で高速化", "Convex Hull Trick", "Monge"],
  },
  {
    name: "データ構造",
    tags: ["set", "map", "priority_queue", "stack・queue", "deque", "Union-Find", "重み付きUnion-Find", "Segment Tree", "遅延Segment Tree", "Binary Indexed Tree", "Sparse Table", "平衡二分探索木", "Wavelet Matrix", "永続データ構造"],
  },
  { name: "ゲーム", tags: ["Nim", "Grundy数", "Minimax法", "Alpha-Beta法", "後退解析", "ミラー戦略"] },
  {
    name: "フロー",
    tags: ["最大流", "最小カット", "燃やす埋める", "最小費用流", "二部マッチング", "最大安定集合", "最小頂点被覆"],
  },
  {
    name: "幾何",
    tags: ["外積・内積", "凸包", "線分交差判定", "偏角ソート", "回転", "最近点対", "反転幾何", "平面走査法", "ピックの定理"],
  },
  { name: "ヒューリスティック", tags: ["マラソン", "焼きなまし法", "山登り法", "ビームサーチ", "乱択"] },
  { name: "その他", tags: ["実装", "シミュレーション", "構築", "考察", "場合分け", "誤差・精度", "インタラクティブ", "その他"] },
];

/** タグの絞り込みで使う別名（略称など） */
const TAG_ALIASES: Record<string, string[]> = {
  深さ優先探索: ["DFS"],
  幅優先探索: ["BFS"],
  "Segment Tree": ["セグ木", "セグメント木", "segtree"],
  "遅延Segment Tree": ["遅延セグ木", "lazy segtree"],
  "Binary Indexed Tree": ["BIT", "フェニック木", "Fenwick"],
  "Union-Find": ["UF", "DSU", "素集合"],
  "重み付きUnion-Find": ["重み付きUF"],
  priority_queue: ["ヒープ", "優先度付きキュー"],
  平衡二分探索木: ["BBST"],
  最小全域木: ["MST", "クラスカル", "プリム"],
  強連結成分分解: ["SCC"],
  最小費用流: ["MCF"],
  最大流: ["フロー"],
  LCA: ["最小共通祖先"],
  "Convex Hull Trick": ["CHT"],
  "FFT・NTT": ["FFT", "NTT"],
  "Mo's algorithm": ["Mo"],
  "LCS・編集距離": ["LCS", "編集距離"],
  LIS: ["最長増加部分列"],
  焼きなまし法: ["SA", "焼きなまし"],
  ビームサーチ: ["ビーム"],
  "GCD・LCM": ["GCD", "LCM", "最大公約数", "最小公倍数"],
};

/**
 * タグの絞り込み。グループ名に一致したらそのグループのタグを全部出す。
 * 戻り値の best は Enter で選ぶ候補（完全一致 > 前方一致 > 部分一致 の順）
 */
export function filterTags(query: string): { groups: { name: string; tags: string[] }[]; best: string | null } {
  const q = query.trim().toLowerCase();
  if (!q) return { groups: TAG_GROUPS, best: null };
  const names = (t: string) => [t, ...(TAG_ALIASES[t] ?? [])].map((n) => n.toLowerCase());
  const score = (t: string) => {
    const ns = names(t);
    if (ns.some((n) => n === q)) return 0;
    if (ns.some((n) => n.startsWith(q))) return 1;
    if (ns.some((n) => n.includes(q))) return 2;
    return -1;
  };
  const groups = TAG_GROUPS.map((g) => (g.name.toLowerCase().includes(q) ? g : { ...g, tags: g.tags.filter((t) => score(t) >= 0) })).filter(
    (g) => g.tags.length > 0,
  );
  const candidates = groups.flatMap((g) => g.tags).filter((t) => score(t) >= 0);
  const best = candidates.sort((a, b) => score(a) - score(b))[0] ?? groups[0]?.tags[0] ?? null;
  return { groups, best };
}

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

export type User = {
  id: number;
  username: string;
  atcoderId: string | null;
  /** AtCoder Problems の提出 API を次に読む from_second */
  submissionsCursor: number;
  submissionsSyncedAt: string | null;
};

/** AtCoder のユーザー名（英数字と _ の 3〜16 文字） */
export const ATCODER_ID_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

/** 1 問ぶんの提出結果のまとめ。ブラウザで集計してサーバーに送る */
export type TaskResult = {
  taskId: string;
  ac: boolean;
  /** 最後の提出の結果（状態として扱えるもののみ） */
  lastResult: Status | null;
  lastEpoch: number;
};

/** 提出結果のうち、状態として反映するもの（WJ や IE などは無視する） */
export const SYNCABLE_RESULTS: readonly Status[] = ["AC", "WA", "TLE", "MLE", "RE", "CE"];

export const MAX_TASK_RESULTS_PER_REQUEST = 5000;

/** 問題 URL から AtCoder の問題 ID（例: abc400_a）を取り出す */
export function taskIdFromUrl(url: string): string | null {
  return url.match(/atcoder\.jp\/contests\/[^/]+\/tasks\/([^/?#]+)/)?.[1] ?? null;
}

export const USERNAME_RULE = { pattern: /^[A-Za-z0-9_\-]{3,20}$/, message: "ユーザー名は 3〜20 文字の半角英数字と「_」「-」で入力してください" };
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

/** サジェストに出すコンテスト */
export type AtCoderContest = {
  contestId: string;
  title: string;
  /** 例: 2026-09-26 21:00:00+0900（アーカイブ未取得の回は null） */
  startAt: string | null;
  kind: "algorithm" | "heuristic" | null;
  /** 問題一覧を取り込み済みか */
  tasksReady: boolean;
};

/** AtCoder から取得した問題（一覧の 1 行） */
export type AtCoderTask = {
  taskId: string;
  label: string;
  title: string;
  url: string;
  /** 配点が書かれていない問題（古いコンテストなど）は null */
  score: number | null;
};

/** コンテスト ID として妥当か（大文字を含む ID もある。例: codequeen2026-final-Public） */
export function parseContestId(input: string): string | null {
  const id = input.trim();
  return /^[A-Za-z0-9][A-Za-z0-9_-]{1,59}$/.test(id) ? id : null;
}

/** サジェストの絞り込み・並べ替え。ID の一致を優先し、同順位なら新しい回を先にする */
export function searchContests(contests: AtCoderContest[], input: string, limit = 8): AtCoderContest[] {
  const query = input.trim().toLowerCase();
  if (!query) return contests.slice(0, limit);
  const compact = query.replace(/[\s_-]/g, "");
  const rank = (c: AtCoderContest) => {
    const id = c.contestId.toLowerCase().replace(/[_-]/g, "");
    if (id === compact) return 0;
    if (id.startsWith(compact)) return 1;
    if (id.includes(compact)) return 2;
    if (c.title.toLowerCase().includes(query)) return 3;
    return -1;
  };
  return contests
    .map((c, i) => ({ c, r: rank(c), i }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.c);
}
