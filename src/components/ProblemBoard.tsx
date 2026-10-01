import { useEffect, useMemo, useState } from "react";
import { DIFFICULTIES, STATUSES, type Difficulty, type Problem, type ProblemInput, type Status } from "../../shared/domain";
import { api } from "../api";
import { DifficultyCircle, StatusBadge } from "./badges";
import { ProblemForm } from "./ProblemForm";

type Editing = { mode: "new" } | { mode: "edit"; problem: Problem } | null;

export function ProblemBoard() {
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [tag, setTag] = useState("");

  useEffect(() => {
    api.listProblems().then(setProblems, (e: Error) => setLoadError(e.message));
  }, []);

  const usedTags = useMemo(() => [...new Set((problems ?? []).flatMap((p) => p.tags))].sort(), [problems]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (problems ?? []).filter(
      (p) =>
        (!q || p.title.toLowerCase().includes(q) || p.memo.toLowerCase().includes(q)) &&
        (!status || p.status === status) &&
        (!difficulty || p.difficulty === difficulty) &&
        (!tag || p.tags.includes(tag)),
    );
  }, [problems, query, status, difficulty, tag]);

  const upsertLocal = (p: Problem) =>
    setProblems((list) => [p, ...(list ?? []).filter((x) => x.id !== p.id)]);

  const save = async (input: ProblemInput) => {
    const saved =
      editing?.mode === "edit" ? await api.updateProblem(editing.problem.id, input) : await api.createProblem(input);
    upsertLocal(saved);
    setEditing(null);
  };

  const remove = async (p: Problem) => {
    if (!confirm(`「${p.title}」を削除しますか？`)) return;
    try {
      await api.deleteProblem(p.id);
      setProblems((list) => (list ?? []).filter((x) => x.id !== p.id));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const quickStatus = async (p: Problem, next: Status) => {
    try {
      upsertLocal(await api.updateProblem(p.id, { ...p, status: next }));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  if (loadError) return <p className="empty">読み込みに失敗しました: {loadError}</p>;
  if (!problems) return <p className="empty">読み込み中…</p>;

  const acCount = problems.filter((p) => p.status === "AC").length;
  const filtered = query || status || difficulty || tag;

  return (
    <div className="board">
      <div className="board-head">
        <div>
          <h1>問題リスト</h1>
          <p className="board-stats">
            {problems.length} 問中 <strong>{acCount}</strong> 問 AC
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ mode: "new" })}>
          ＋ 問題を追加
        </button>
      </div>

      {problems.length > 0 && <DifficultyBar problems={problems} />}

      <div className="filters">
        <input
          type="search"
          className="input"
          placeholder="問題名・メモで検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Status | "")}>
          <option value="">状態: すべて</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | "")}>
          <option value="">Diff: すべて</option>
          {DIFFICULTIES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <select className="input" value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">タグ: すべて</option>
          {usedTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="empty">
          {filtered ? "条件に合う問題がありません" : "まだ問題がありません。「＋ 問題を追加」から登録してみましょう！"}
        </p>
      ) : (
        <ul className="problem-list">
          {visible.map((p) => (
            <li key={p.id} className="problem-card">
              <div className="problem-main">
                <DifficultyCircle difficulty={p.difficulty} />
                <a className="problem-title" href={p.url} target="_blank" rel="noreferrer">
                  {p.title}
                </a>
              </div>
              {p.tags.length > 0 && (
                <div className="tags">
                  {p.tags.map((t) => (
                    <button type="button" key={t} className="tag" onClick={() => setTag(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
              {p.memo && <p className="problem-memo">{p.memo}</p>}
              <div className="problem-actions">
                <StatusBadge status={p.status} onChange={(s) => quickStatus(p, s)} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ mode: "edit", problem: p })}>
                  編集
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(p)}>
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ProblemForm
          initial={editing.mode === "edit" ? editing.problem : undefined}
          onSubmit={save}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function DifficultyBar({ problems }: { problems: Problem[] }) {
  const counts = DIFFICULTIES.map((d) => ({ ...d, n: problems.filter((p) => p.difficulty === d.value).length })).filter(
    (d) => d.n > 0,
  );
  return (
    <div className="diff-bar" role="img" aria-label={counts.map((d) => `${d.label} ${d.n}問`).join("、")}>
      {counts.map((d) => (
        <span key={d.value} style={{ flexGrow: d.n, background: d.color }} title={`${d.label}: ${d.n}問`} />
      ))}
    </div>
  );
}
