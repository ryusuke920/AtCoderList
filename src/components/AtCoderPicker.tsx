import { useState, type Ref } from "react";
import { parseContestId, type AtCoderTask } from "../../shared/domain";
import { api } from "../api";

type Props = {
  onPick: (picked: { url: string; title: string; score: number | null }) => void;
  ref?: Ref<HTMLInputElement>;
};

/** コンテスト ID を入れて問題を選ぶと、取り込み済みの URL・問題名・配点を入力する */
export function AtCoderPicker({ onPick, ref }: Props) {
  const [contestInput, setContestInput] = useState("");
  const [loaded, setLoaded] = useState<{ contestId: string; tasks: AtCoderTask[] } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const contestId = parseContestId(contestInput);
    if (!contestId) {
      setMessage("コンテスト ID を入力してください（例: ABC400）");
      return;
    }
    setLoading(true);
    setMessage(null);
    setSelected(null);
    try {
      setLoaded(await api.atcoderTasks(contestId));
    } catch (e) {
      setLoaded(null);
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const pick = (task: AtCoderTask) => {
    if (!loaded) return;
    setSelected(task.taskId);
    onPick({ url: task.url, title: `${loaded.contestId.toUpperCase()} ${task.label} - ${task.title}`, score: task.score });
  };

  return (
    <div className="picker">
      <span className="field-label">AtCoder から入力</span>
      <div className="picker-row">
        <input
          ref={ref}
          className="input"
          placeholder="コンテスト（例: ABC400）"
          value={contestInput}
          onChange={(e) => setContestInput(e.target.value)}
          onKeyDown={(e) => {
            // フォーム全体が送信されないようにする
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              load();
            }
          }}
        />
        <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}>
          {loading ? "読み込み中…" : "読み込む"}
        </button>
      </div>
      {loaded && (
        <div className="chips picker-tasks">
          {loaded.tasks.map((t) => (
            <button
              type="button"
              key={t.taskId}
              className="chip chip-tag"
              aria-pressed={selected === t.taskId}
              title={t.title}
              onClick={() => pick(t)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {message && <p className="picker-message">{message}</p>}
    </div>
  );
}
