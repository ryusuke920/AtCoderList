import type { Problem, ProblemInput, User } from "../shared/domain";

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
  signup: (username: string, password: string) =>
    request<{ user: User }>("/auth/signup", { method: "POST", body: JSON.stringify({ username, password }) }).then((r) => r.user),
  login: (username: string, password: string) =>
    request<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }).then((r) => r.user),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  listProblems: () => request<{ problems: Problem[] }>("/api/problems").then((r) => r.problems),
  createProblem: (input: ProblemInput) =>
    request<{ problem: Problem }>("/api/problems", { method: "POST", body: JSON.stringify(input) }).then((r) => r.problem),
  updateProblem: (id: number, input: ProblemInput) =>
    request<{ problem: Problem }>(`/api/problems/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.problem),
  deleteProblem: (id: number) => request<void>(`/api/problems/${id}`, { method: "DELETE" }),
};
