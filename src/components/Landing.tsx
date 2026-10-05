import { useState, type FormEvent } from "react";
import { PASSWORD_RULE, USERNAME_RULE, type User } from "../../shared/domain";
import { api } from "../api";
import { RecoveryCodeDialog } from "./RecoveryCodeDialog";

type Mode = "login" | "signup" | "recover";

export function Landing({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  return (
    <section className="landing">
      <div className="landing-text">
        <p className="landing-sub">AtCoder 問題管理ツール</p>
        <h1 className="landing-title">AtCoder List</h1>
        <p className="landing-desc">
          今後解きたい問題や、復習したい問題をストックしておけるサービスです。
          <br />
          Difficulty・状態・アルゴリズムで整理して、あとから一瞬で開けます。
        </p>
        <AuthForm onAuthenticated={onAuthenticated} />
        <p className="landing-guide">
          はじめての方は <a href="/guide">使い方</a> をご覧ください
        </p>
      </div>
      <img className="landing-image" src="/top.png" alt="" />
    </section>
  );
}

function AuthForm({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 登録・復旧のあとは、新しい復旧コードを控えてもらってから中に入る
  const [pending, setPending] = useState<{ user: User; code: string } | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirm("");
    setRecoveryCode("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode !== "login" && password !== confirm) {
      setError("確認用パスワードが一致しません");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") {
        onAuthenticated(await api.login(username, password));
      } else {
        const res = mode === "signup" ? await api.signup(username, password) : await api.recover(username, recoveryCode, password);
        setPending({ user: res.user, code: res.recoveryCode });
      }
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isRecover = mode === "recover";

  return (
    <form className="auth-card" onSubmit={submit}>
      {isRecover ? (
        <div className="auth-recover-head">
          <h2>パスワードの再設定</h2>
          <p className="field-hint">登録時に控えた復旧コードで、新しいパスワードを設定します。</p>
        </div>
      ) : (
        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={isLogin} onClick={() => switchMode("login")}>
            ログイン
          </button>
          <button type="button" role="tab" aria-selected={isSignup} onClick={() => switchMode("signup")}>
            新規登録
          </button>
        </div>
      )}

      <label className="field">
        <span className="field-label">ユーザー名</span>
        <input
          className="input"
          required
          autoComplete="username"
          pattern={isSignup ? USERNAME_RULE.pattern.source : undefined}
          title={isSignup ? USERNAME_RULE.message : undefined}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        {isSignup && <span className="field-hint">3〜20 文字。半角英数字と「_」「-」が使えます</span>}
      </label>

      {isRecover && (
        <label className="field">
          <span className="field-label">復旧コード</span>
          <input
            className="input"
            required
            autoComplete="off"
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
          />
        </label>
      )}

      <label className="field">
        <span className="field-label">{isRecover ? "新しいパスワード" : "パスワード"}</span>
        <input
          className="input"
          type="password"
          required
          minLength={isLogin ? undefined : PASSWORD_RULE.min}
          maxLength={PASSWORD_RULE.max}
          autoComplete={isLogin ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {!isLogin && <span className="field-hint">{PASSWORD_RULE.min}文字以上</span>}
      </label>

      {!isLogin && (
        <label className="field">
          <span className="field-label">{isRecover ? "新しいパスワード（確認）" : "パスワード（確認）"}</span>
          <input
            className="input"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
      )}

      {isSignup && (
        <p className="field-hint auth-note">
          登録後に表示される「復旧コード」を控えておくと、パスワードを忘れても再設定できます。メールアドレスは使いません。
        </p>
      )}

      {error && <p className="form-error">{error}</p>}

      <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={submitting}>
        {submitting ? "送信中…" : isSignup ? "登録してはじめる" : isRecover ? "パスワードを再設定" : "ログイン"}
      </button>

      {isLogin && (
        <button type="button" className="link-button" onClick={() => switchMode("recover")}>
          パスワードを忘れた
        </button>
      )}
      {isRecover && (
        <button type="button" className="link-button" onClick={() => switchMode("login")}>
          ログインに戻る
        </button>
      )}

      {pending && <RecoveryCodeDialog code={pending.code} onDone={() => onAuthenticated(pending.user)} />}
    </form>
  );
}
