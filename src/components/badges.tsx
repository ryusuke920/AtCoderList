import { DIFFICULTIES, STATUSES, type Difficulty, type Status } from "../../shared/domain";

export function DifficultyCircle({ difficulty }: { difficulty: Difficulty }) {
  const d = DIFFICULTIES.find((x) => x.value === difficulty)!;
  return <span className="diff-circle" style={{ borderColor: d.color, background: d.value === "unset" ? "transparent" : d.color }} title={`Difficulty: ${d.label}`} />;
}

/** 状態バッジ（提出結果から自動で決まるので表示だけ） */
export function StatusBadge({ status }: { status: Status }) {
  const s = STATUSES.find((x) => x.value === status)!;
  return (
    <span className="status" style={{ background: s.color }}>
      {s.label}
    </span>
  );
}
