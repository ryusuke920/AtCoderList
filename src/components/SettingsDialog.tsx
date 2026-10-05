import { useEffect, useRef, useState, type FormEvent } from "react";
import { ATCODER_ID_PATTERN, type User } from "../../shared/domain";
import { api } from "../api";
import { RecoveryCodeDialog } from "./RecoveryCodeDialog";

type Props = {
  user: User;
  onSaved: (user: User) => void;
  onDeleted: () => void;
  onClose: () => void;
};

export function SettingsDialog({ user, onSaved, onDeleted, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog ref={dialogRef} className="dialog dialog-narrow" onClose={onClose}>
      <div className="dialog-body">
        <div className="dialog-head">
          <h2>設定</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>
        <AtCoderIdSection user={user} onSaved={onSaved} />
        <RecoverySection user={user} onSaved={onSaved} />
        <DeleteSection onDeleted={onDeleted} />
      </div>
    </dialog>
  );
}

function AtCoderIdSection({ user, onSaved }: { user: User; onSaved: (user: User) => void }) {
  const [atcoderId, setAtcoderId] = useState(user.atcoderId ?? "");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      onSaved(await api.setAtcoderId(atcoderId.trim() || null));
      setMessage({ text: "保存しました" });
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="settings-card" onSubmit={submit}>
      <h3>AtCoder ID</h3>
      <p className="settings-lead">登録すると、問題の状態（AC / WA / 未提出 など）が提出結果から自動で入ります。</p>
      <div className="inline-form">
        <input
          className="input"
          placeholder="例）chokudai"
          autoComplete="off"
          aria-label="AtCoder ID"
          pattern={ATCODER_ID_PATTERN.source}
          title="半角英数字と「_」の 3〜16 文字"
          value={atcoderId}
          onChange={(e) => setAtcoderId(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={saving}>
          保存
        </button>
      </div>
      {message && <p className={message.error ? "form-error" : "sync-message"}>{message.text}</p>}
      <ul className="settings-note">
        <li>一度でも AC していれば「AC」、まだなら最後の提出の結果になります</li>
        <li>問題を追加したとき、問題一覧を開いたとき（10 分に 1 回まで）、「同期」を押したときに更新します</li>
        <li>
          提出データは非公式の{" "}
          <a href="https://github.com/kenkoooo/AtCoderProblems" target="_blank" rel="noreferrer">
            AtCoder Problems
          </a>{" "}
          の API から、このブラウザで直接取得します。反映まで数分かかることがあります
        </li>
        <li>ID を変えると最初から読み直します</li>
      </ul>
    </form>
  );
}

function RecoverySection({ user, onSaved }: { user: User; onSaved: (user: User) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.reissueRecoveryCode(password);
      setPassword("");
      setCode(res.recoveryCode);
      onSaved(res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="settings-card" onSubmit={submit}>
      <h3>
        復旧コード
        <span className={user.hasRecoveryCode ? "pill pill-ok" : "pill pill-warn"}>{user.hasRecoveryCode ? "発行済み" : "未発行"}</span>
      </h3>
      <p className="settings-lead">パスワードを忘れたときに、新しいパスワードを設定するための合言葉です。</p>
      <ul className="settings-note">
        <li>
          使うとき: ログイン画面の「パスワードを忘れた」で、ユーザー名・このコード・新しいパスワードを入力します
        </li>
        <li>コードは発行したときに一度だけ表示されます。パスワード管理アプリやメモに保存してください</li>
        <li>なくしたら再発行できます（前のコードは使えなくなります）。再発行にはログインパスワードが必要です</li>
      </ul>
      {user.hasRecoveryCode ? (
        <div className="inline-form">
          <input
            className="input"
            type="password"
            required
            placeholder="このアプリのログインパスワード"
            aria-label="このアプリのログインパスワード"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn btn-ghost" disabled={busy}>
            再発行
          </button>
        </div>
      ) : (
        // 未発行なら、ログイン中であればパスワードなしで最初の 1 回を発行できる
        <button type="submit" className="btn btn-primary" disabled={busy}>
          復旧コードを発行する
        </button>
      )}
      {error && <p className="form-error">{error}</p>}
      {code && <RecoveryCodeDialog code={code} onDone={() => setCode(null)} />}
    </form>
  );
}

function DeleteSection({ onDeleted }: { onDeleted: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirm("アカウントと登録した問題をすべて削除します。元に戻せません。よろしいですか？")) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      onDeleted();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="settings-card settings-danger" onSubmit={submit}>
      <h3>アカウントの削除</h3>
      <p className="settings-lead">アカウントと、登録した問題・タグ・メモ・同期した提出結果をすべて削除します。</p>
      <ul className="settings-note">
        <li>削除すると元に戻せません。同じユーザー名で登録し直すことはできます</li>
        <li>確認のため、このアプリのログインパスワードを入力してください</li>
      </ul>
      <div className="inline-form">
        <input
          className="input"
          type="password"
          required
          placeholder="このアプリのログインパスワード"
          aria-label="このアプリのログインパスワード（削除の確認）"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="btn btn-danger" disabled={busy}>
          削除する
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
