import { useState } from "react";
import { DIFFICULTIES, STATUSES, type Problem, type Status } from "../../shared/domain";
import { DifficultyCircle, StatusBadge } from "./badges";

export type SortKey = "updated" | "title" | "score" | "difficulty" | "status";
export type Sort = { key: SortKey; desc: boolean };

/** D1 の datetime('now')（UTC）を日本時間の「10/02」にする */
const formatDate = (utc: string) =>
  new Date(`${utc.replace(" ", "T")}Z`).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" });

const difficultyRank = (p: Problem) => DIFFICULTIES.findIndex((d) => d.value === p.difficulty);
const statusRank = (p: Problem) => STATUSES.findIndex((s) => s.value === p.status);

/** 並べ替え。配点なしは常に最後。同じ値なら新しく更新した順 */
export function sortProblems(problems: Problem[], { key, desc }: Sort): Problem[] {
  const byUpdated = (a: Problem, b: Problem) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id;
  const compare: Record<SortKey, (a: Problem, b: Problem) => number> = {
    updated: (a, b) => -byUpdated(a, b),
    title: (a, b) => a.title.localeCompare(b.title, "ja", { numeric: true }),
    score: (a, b) => (a.score ?? 0) - (b.score ?? 0),
    difficulty: (a, b) => difficultyRank(a) - difficultyRank(b),
    status: (a, b) => statusRank(a) - statusRank(b),
  };
  return [...problems].sort((a, b) => {
    if (key === "score" && (a.score === null) !== (b.score === null)) return a.score === null ? 1 : -1;
    const c = compare[key](a, b);
    return (desc ? -c : c) || byUpdated(a, b);
  });
}

type Props = {
  problems: Problem[];
  sort: Sort;
  onSort: (key: SortKey) => void;
  onTag: (tag: string) => void;
  onStatus: (p: Problem, s: Status) => void;
  onEdit: (p: Problem) => void;
  onDelete: (p: Problem) => void;
};

export function ProblemTable({ problems, sort, onSort, onTag, onStatus, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleMemo = (id: number) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const header = (key: SortKey, label: string, className?: string) => (
    <th className={className} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : undefined}>
      <button type="button" className="sort-button" onClick={() => onSort(key)}>
        {label}
        <span className="sort-mark" aria-hidden="true">
          {sort.key === key ? (sort.desc ? "▼" : "▲") : ""}
        </span>
      </button>
    </th>
  );

  return (
    <table className="problem-table">
      <thead>
        <tr>
          {header("difficulty", "Diff", "col-diff")}
          {header("title", "問題", "col-title")}
          {header("score", "配点", "col-score")}
          <th className="col-tags">タグ</th>
          {header("status", "状態", "col-status")}
          {header("updated", "更新日", "col-updated")}
          <th className="col-actions">
            <span className="visually-hidden">操作</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {problems.map((p) => (
          <tr key={p.id}>
            <td className="col-diff">
              <DifficultyCircle difficulty={p.difficulty} />
            </td>
            <td className="col-title">
              <div className="title-cell">
                <a className="problem-title" href={p.url} target="_blank" rel="noreferrer" title={p.title}>
                  {p.title}
                </a>
              </div>
              {p.memo && (
                // 2 行まで表示し、押すと全文を開く
                <button
                  type="button"
                  className="problem-memo"
                  aria-expanded={expanded.has(p.id)}
                  onClick={() => toggleMemo(p.id)}
                >
                  {p.memo}
                </button>
              )}
            </td>
            <td className="col-score">
              {p.score !== null ? (
                <>
                  {p.score}
                  <span className="score-unit">点</span>
                </>
              ) : (
                <span className="muted">-</span>
              )}
            </td>
            <td className="col-tags">
              {p.tags.map((t) => (
                <button type="button" key={t} className="tag" onClick={() => onTag(t)}>
                  {t}
                </button>
              ))}
            </td>
            <td className="col-status">
              <StatusBadge status={p.status} onChange={(s) => onStatus(p, s)} />
            </td>
            <td className="col-updated">{formatDate(p.updatedAt)}</td>
            <td className="col-actions">
              <button type="button" className="icon-button" onClick={() => onEdit(p)} aria-label={`${p.title} を編集`} title="編集">
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                  <path d="M11.5 2.5l2 2L6 12l-3 1 1-3z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                className="icon-button icon-danger"
                onClick={() => onDelete(p)}
                aria-label={`${p.title} を削除`}
                title="削除"
              >
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                  <path
                    d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
