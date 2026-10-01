import { useState, type Ref } from "react";
import { parseContestId, type AtCoderTask } from "../../shared/domain";
import { api } from "../api";

type Props = {
  /** 問題を選んだ直後に呼ばれる（配点はまだ取得中のことがある） */
  onPick: (picked: { url: string; title: string; taskId: string }) => void;
  /** 配点を取得できたら呼ばれる */
  onScore: (taskId: string, score: number | null) => void;
  ref?: Ref<HTMLInputElement>;
};

/** コンテスト ID を入れて問題を選ぶと、URL・問題名・配点を AtCoder から取ってくる */
export function AtCoderPicker({ onPick, onScore, ref }: Props) {
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

  const pick = async (task: AtCoderTask) => {
    if (!loaded) return;
    setSelected(task.taskId);
    setMessage(null);
    onPick({ url: task.url, title: `${loaded.contestId.toUpperCase()} ${task.label} - ${task.title}`, taskId: task.taskId });
    if (task.score !== undefined) {
      onScore(task.taskId, task.score);
      return;
    }
    try {
      const detail = await api.atcoderTask(loaded.contestId, task.taskId);
      // 次に選んだときのためにキャッシュしておく
      setLoaded((l) => l && { ...l, tasks: l.tasks.map((t) => (t.taskId === detail.taskId ? detail : t)) });
      onScore(detail.taskId, detail.score ?? null);
    } catch (e) {
      setMessage(`配点を取得できませんでした: ${(e as Error).message}`);
    }
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
