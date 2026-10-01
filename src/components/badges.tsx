import { DIFFICULTIES, STATUSES, type Difficulty, type Status } from "../../shared/domain";

export function DifficultyCircle({ difficulty }: { difficulty: Difficulty }) {
  const d = DIFFICULTIES.find((x) => x.value === difficulty)!;
  return <span className="diff-circle" style={{ borderColor: d.color, background: d.value === "unset" ? "transparent" : d.color }} title={`Difficulty: ${d.label}`} />;
}

/** 状態バッジ。onChange を渡すとその場で状態を変更できるセレクトになる */
export function StatusBadge({ status, onChange }: { status: Status; onChange?: (s: Status) => void }) {
  const s = STATUSES.find((x) => x.value === status)!;
  if (!onChange) return <span className="status" style={{ background: s.color }}>{s.label}</span>;
  // iOS Safari は <select> の文字を中央寄せできないので、表示は span で行い、透明な select を重ねて操作だけ受け持たせる
  return (
    <label className="status status-picker" style={{ background: s.color }}>
      {s.label}
      <select
        className="status-overlay"
        value={status}
        aria-label="状態を変更"
        onChange={(e) => onChange(e.target.value as Status)}
      >
        {STATUSES.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
    </label>
  );
}
