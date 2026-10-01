import { useEffect, useId, useMemo, useState, type KeyboardEvent, type Ref } from "react";
import { searchContests, type AtCoderContest, type AtCoderTask } from "../../shared/domain";
import { api } from "../api";

type Props = {
  onPick: (picked: { url: string; title: string; score: number | null }) => void;
  ref?: Ref<HTMLInputElement>;
};

// コンテスト一覧はページを開いている間は使い回す
let contestsPromise: Promise<AtCoderContest[]> | null = null;
const loadContests = () => {
  contestsPromise ??= api.atcoderContests().catch((e) => {
    contestsPromise = null;
    throw e;
  });
  return contestsPromise;
};

const formatDate = (startAt: string | null) => (startAt ? startAt.slice(0, 10).replace(/-/g, "/") : "");

/** コンテスト名や ID を打つと候補が出て、選ぶとその回の問題を選べる。選んだ問題の URL・問題名・配点を入力する */
export function AtCoderPicker({ onPick, ref }: Props) {
  const listId = useId();
  const [contests, setContests] = useState<AtCoderContest[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [contest, setContest] = useState<AtCoderContest | null>(null);
  const [tasks, setTasks] = useState<AtCoderTask[] | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadContests().then(setContests, (e: Error) => setMessage(`コンテスト一覧を読み込めませんでした: ${e.message}`));
  }, []);

  const suggestions = useMemo(() => (contests ? searchContests(contests, query) : []), [contests, query]);

  const choose = async (c: AtCoderContest) => {
    setContest(c);
    setQuery(`${c.contestId.toUpperCase()} — ${c.title}`);
    setOpen(false);
    setTasks(null);
    setSelectedTask(null);
    setMessage(null);
    try {
      setTasks((await api.atcoderTasks(c.contestId)).tasks);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const pick = (task: AtCoderTask) => {
    if (!contest) return;
    setSelectedTask(task.taskId);
    onPick({ url: task.url, title: `${contest.contestId.toUpperCase()} ${task.label} - ${task.title}`, score: task.score });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (suggestions.length ? (i + delta + suggestions.length) % suggestions.length : 0));
    } else if (e.key === "Enter") {
      // フォーム全体が送信されないようにする
      e.preventDefault();
      if (open && suggestions[active]) choose(suggestions[active]);
    } else if (e.key === "Escape" && open) {
      // ダイアログごと閉じないようにする
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="picker">
      <span className="field-label">AtCoder から入力</span>
      <div className="combobox">
        <input
          ref={ref}
          className="input"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-activedescendant={open && suggestions[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          placeholder={contests ? "コンテスト名や ID で検索（例: abc477、企業）" : "コンテスト一覧を読み込み中…"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
            // 打ち直したら前に選んだコンテストの問題は消す
            setContest(null);
            setTasks(null);
            setMessage(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {open && suggestions.length > 0 && (
          <ul className="suggestions" id={listId} role="listbox">
            {suggestions.map((c, i) => (
              <li
                key={c.contestId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className="suggestion"
                // blur より先に選択させる
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(c);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="suggestion-id">{c.contestId.toUpperCase()}</span>
                <span className="suggestion-title">{c.title}</span>
                <span className="suggestion-meta">
                  {c.kind === "heuristic" && "ヒューリスティック · "}
                  {formatDate(c.startAt)}
                  {!c.tasksReady && " · 問題取り込み待ち"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {tasks && (
        <div className="chips picker-tasks">
          {tasks.map((t) => (
            <button
              type="button"
              key={t.taskId}
              className="chip chip-tag"
              aria-pressed={selectedTask === t.taskId}
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
