import type { AtCoderContest, AtCoderTask, Problem, ProblemInput, TaskResult, User } from "../shared/domain";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `エラーが発生しました (${res.status})`);
  return data as T;
}

export const api = {
  me: () => request<{ user: User | null }>("/api/me").then((r) => r.user),
  /** 登録すると復旧コードが一度だけ返ってくる */
  signup: (username: string, password: string) =>
    request<{ user: User; recoveryCode: string }>("/auth/signup", { method: "POST", body: JSON.stringify({ username, password }) }),
  /** 復旧コードでパスワードを再設定する。使ったコードは無効になり、新しいコードが返ってくる */
  recover: (username: string, recoveryCode: string, newPassword: string) =>
    request<{ user: User; recoveryCode: string }>("/auth/recover", {
      method: "POST",
      body: JSON.stringify({ username, recoveryCode, newPassword }),
    }),
  reissueRecoveryCode: (password: string) =>
    request<{ user: User; recoveryCode: string }>("/api/account/recovery-code", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  deleteAccount: (password: string) => request<void>("/api/account", { method: "DELETE", body: JSON.stringify({ password }) }),
  login: (username: string, password: string) =>
    request<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }).then((r) => r.user),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  listProblems: () => request<{ problems: Problem[] }>("/api/problems").then((r) => r.problems),
  createProblem: (input: ProblemInput) =>
    request<{ problem: Problem }>("/api/problems", { method: "POST", body: JSON.stringify(input) }).then((r) => r.problem),
  updateProblem: (id: number, input: ProblemInput) =>
    request<{ problem: Problem }>(`/api/problems/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.problem),
  atcoderContests: () => request<{ contests: AtCoderContest[] }>("/api/atcoder/contests").then((r) => r.contests),
  atcoderTasks: (contestId: string) =>
    request<{ contestId: string; tasks: AtCoderTask[] }>(`/api/atcoder/contests/${encodeURIComponent(contestId)}/tasks`),
  setAtcoderId: (atcoderId: string | null) =>
    request<{ user: User }>("/api/sync/atcoder-id", { method: "PUT", body: JSON.stringify({ atcoderId }) }).then((r) => r.user),
  postTaskResults: (atcoderId: string, cursor: number, results: TaskResult[]) =>
    request<{ updated: number; user: User }>("/api/sync/results", {
      method: "POST",
      body: JSON.stringify({ atcoderId, cursor, results }),
    }),
  deleteProblem: (id: number) => request<void>(`/api/problems/${id}`, { method: "DELETE" }),
};
