import { useCallback, useEffect, useMemo, useState } from "react";
import { DIFFICULTIES, STATUSES, type Difficulty, type Problem, type ProblemInput, type Status, type User } from "../../shared/domain";
import { api } from "../api";
import { SyncBar } from "./SyncBar";
import { ProblemTable, sortProblems, type Sort, type SortKey } from "./ProblemTable";

const SORT_OPTIONS = [
  { value: "updated:desc", label: "更新日が新しい順" },
  { value: "updated:asc", label: "更新日が古い順" },
  { value: "difficulty:desc", label: "Diff が高い順" },
  { value: "difficulty:asc", label: "Diff が低い順" },
  { value: "score:desc", label: "配点が高い順" },
  { value: "score:asc", label: "配点が低い順" },
  { value: "title:asc", label: "問題名順" },
  { value: "status:asc", label: "状態順" },
];
import { ProblemForm } from "./ProblemForm";

type Editing = { mode: "new" } | { mode: "edit"; problem: Problem } | null;

type Props = {
  user: User;
  onUserChange: (user: User) => void;
  onOpenSettings: () => void;
};

export function ProblemBoard({ user, onUserChange, onOpenSettings }: Props) {
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "updated", desc: true });

  const reload = useCallback(() => {
    api.listProblems().then(setProblems, (e: Error) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const usedTags = useMemo(() => [...new Set((problems ?? []).flatMap((p) => p.tags))].sort(), [problems]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (problems ?? []).filter(
      (p) =>
        (!q || p.title.toLowerCase().includes(q) || p.memo.toLowerCase().includes(q)) &&
        (!status || p.status === status) &&
        (!difficulty || p.difficulty === difficulty) &&
        (!tag || p.tags.includes(tag)),
    );
    return sortProblems(filtered, sort);
  }, [problems, query, status, difficulty, tag, sort]);

  const upsertLocal = (p: Problem) =>
    setProblems((list) => [p, ...(list ?? []).filter((x) => x.id !== p.id)]);

  // 追加したら、その問題の最新の提出を取りにいく（SyncBar が同期する）
  const [syncRequest, setSyncRequest] = useState(0);

  const save = async (input: ProblemInput) => {
    const isNew = editing?.mode !== "edit";
    const saved = isNew ? await api.createProblem(input) : await api.updateProblem(editing.problem.id, input);
    upsertLocal(saved);
    setEditing(null);
    if (isNew) setSyncRequest((n) => n + 1);
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

      <SyncBar
        user={user}
        syncRequest={syncRequest}
        onUserChange={onUserChange}
        onUpdated={reload}
        onOpenSettings={onOpenSettings}
      />

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
        {/* スマホでは表の見出しが出ないので、並び替えはここで選ぶ */}
        <select
          className="input sort-select"
          aria-label="並び替え"
          value={`${sort.key}:${sort.desc ? "desc" : "asc"}`}
          onChange={(e) => {
            const [key, dir] = e.target.value.split(":");
            setSort({ key: key as SortKey, desc: dir === "desc" });
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="empty">
          {filtered ? "条件に合う問題がありません" : "まだ問題がありません。「＋ 問題を追加」から登録してみましょう！"}
        </p>
      ) : (
        <ProblemTable
          problems={visible}
          sort={sort}
          onSort={(key) => setSort((cur) => (cur.key === key ? { key, desc: !cur.desc } : { key, desc: key !== "title" }))}
          onTag={setTag}
          onEdit={(p) => setEditing({ mode: "edit", problem: p })}
          onDelete={remove}
        />
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
