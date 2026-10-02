import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AtCoderPicker } from "./AtCoderPicker";
import {
  DIFFICULTIES,
  filterTags,
  guessTitleFromUrl,
  type Problem,
  type ProblemInput,
} from "../../shared/domain";

const EMPTY: ProblemInput = { title: "", url: "", difficulty: "unset", status: "todo", memo: "", score: null, tags: [] };

type Props = {
  initial?: Problem;
  onSubmit: (input: ProblemInput) => Promise<void>;
  onClose: () => void;
};

export function ProblemForm({ initial, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProblemInput>(initial ?? EMPTY);
  const [titleTouched, setTitleTouched] = useState(Boolean(initial));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tagQuery, setTagQuery] = useState("");

  const { groups: visibleTagGroups, best: bestTag } = useMemo(() => filterTags(tagQuery), [tagQuery]);

  useEffect(() => {
    dialogRef.current?.showModal();
    // showModal() は最初のフォーカス可能要素（閉じるボタン）にフォーカスするので入力欄に移す。
    // タッチ端末ではいきなりキーボードが出ないよう、フォーカスしない
    if (matchMedia("(pointer: fine)").matches) firstFieldRef.current?.focus();
    else (document.activeElement as HTMLElement | null)?.blur();
  }, []);

  const set = <K extends keyof ProblemInput>(key: K, value: ProblemInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onUrlChange = (url: string) => {
    const guessed = guessTitleFromUrl(url);
    setForm((f) => ({ ...f, url, title: !titleTouched && guessed ? guessed : f.title }));
  };

  const toggleTag = (tag: string) =>
    set("tags", form.tags.includes(tag) ? form.tags.filter((t) => t !== tag) : [...form.tags, tag]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dialog-head">
          <h2>{initial ? "問題を編集" : "問題を追加"}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        {!initial && (
          <AtCoderPicker
            ref={firstFieldRef}
            onPick={({ url, title, score }) => {
              setTitleTouched(true);
              setForm((f) => ({ ...f, url, title, score }));
            }}
          />
        )}

        <label className="field">
          <span className="field-label">問題の URL</span>
          <input
            className="input"
            type="url"
            required
            ref={initial ? firstFieldRef : undefined}
            placeholder="https://atcoder.jp/contests/abc184/tasks/abc184_c"
            value={form.url}
            onChange={(e) => onUrlChange(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">問題名</span>
          <input
            className="input"
            required
            placeholder="例）ABC184 C - Super Ryuma"
            value={form.title}
            onChange={(e) => {
              setTitleTouched(true);
              set("title", e.target.value);
            }}
          />
        </label>

        <label className="field">
          <span className="field-label">
            配点 <span className="field-hint">（任意）</span>
          </span>
          <input
            className="input input-score"
            type="number"
            min={0}
            step={1}
            placeholder="例）300"
            value={form.score ?? ""}
            onChange={(e) => set("score", e.target.value === "" ? null : Number(e.target.value))}
          />
        </label>

        <fieldset className="field">
          <legend className="field-label">Difficulty</legend>
          <div className="chips">
            {DIFFICULTIES.map((d) => (
              <button
                type="button"
                key={d.value}
                className="chip"
                aria-pressed={form.difficulty === d.value}
                style={{ "--chip-color": d.color } as React.CSSProperties}
                onClick={() => set("difficulty", d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </fieldset>

        <p className="field-hint status-hint">
          状態（AC / WA / 未提出 など）は、設定した AtCoder ID の提出結果から自動で入ります。
        </p>

        <fieldset className="field">
          <legend className="field-label">
            アルゴリズム <span className="field-hint">（複数選択可）</span>
          </legend>
          {form.tags.length > 0 && (
            <div className="chips selected-tags">
              {form.tags.map((t) => (
                <button type="button" key={t} className="chip chip-tag" aria-pressed="true" onClick={() => toggleTag(t)} title="クリックで外す">
                  {t} ✕
                </button>
              ))}
            </div>
          )}
          <input
            className="input tag-filter"
            type="search"
            placeholder="タグを絞り込む（例: DP、セグ木、BFS、グラフ）。Enter で付け外し"
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter でいちばん近い候補を付け外しする（フォームは送信しない）
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (bestTag) toggleTag(bestTag);
              }
            }}
          />
          <div className="tag-groups">
            {visibleTagGroups.length === 0 && <p className="field-hint">一致するタグがありません</p>}
            {visibleTagGroups.map((g) => (
              <div key={g.name} className="tag-group">
                <span className="tag-group-name">{g.name}</span>
                <div className="chips">
                  {g.tags.map((t) => (
                    <button type="button" key={t} className="chip chip-tag" aria-pressed={form.tags.includes(t)} onClick={() => toggleTag(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span className="field-label">メモ</span>
          <textarea
            className="input"
            rows={3}
            placeholder="解法の方針や詰まったポイントなど"
            value={form.memo}
            onChange={(e) => set("memo", e.target.value)}
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "保存中…" : initial ? "更新する" : "追加する"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
