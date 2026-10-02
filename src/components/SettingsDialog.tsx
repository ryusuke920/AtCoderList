import { useEffect, useRef, useState, type FormEvent } from "react";
import { ATCODER_ID_PATTERN, type User } from "../../shared/domain";
import { api } from "../api";

type Props = {
  user: User;
  onSaved: (user: User) => void;
  onClose: () => void;
};

export function SettingsDialog({ user, onSaved, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [atcoderId, setAtcoderId] = useState(user.atcoderId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.setAtcoderId(atcoderId.trim() || null));
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialogRef} className="dialog dialog-narrow" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dialog-head">
          <h2>設定</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <label className="field">
          <span className="field-label">AtCoder ID</span>
          <input
            className="input"
            placeholder="例）chokudai"
            autoComplete="off"
            pattern={ATCODER_ID_PATTERN.source}
            title="半角英数字と「_」の 3〜16 文字"
            value={atcoderId}
            onChange={(e) => setAtcoderId(e.target.value)}
          />
        </label>
        <div className="settings-note">
          <p>設定すると、登録した問題の状態をあなたの提出結果から自動で更新します。</p>
          <ul>
            <li>一度でも AC していれば「AC」、まだなら最後の提出の結果（WA / TLE など）になります</li>
            <li>問題一覧を開いたとき（10 分に 1 回まで）と、「同期」ボタンを押したときに更新します</li>
            <li>手で変えた状態は、その問題に新しい提出があるまでそのままです</li>
            <li>
              提出データは非公式の{" "}
              <a href="https://github.com/kenkoooo/AtCoderProblems" target="_blank" rel="noreferrer">
                AtCoder Problems
              </a>{" "}
              の API から、このブラウザで直接取得します。反映まで数分かかることがあります
            </li>
            <li>空欄にして保存すると自動更新を止めます。ID を変えると最初から読み直します</li>
          </ul>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "保存中…" : "保存する"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
