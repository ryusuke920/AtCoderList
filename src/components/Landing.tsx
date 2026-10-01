import { useState, type FormEvent } from "react";
import { PASSWORD_RULE, USERNAME_RULE, type User } from "../../shared/domain";
import { api } from "../api";

type Mode = "login" | "signup";

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setConfirm("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && password !== confirm) {
      setError("確認用パスワードが一致しません");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      onAuthenticated(mode === "signup" ? await api.signup(username, password) : await api.login(username, password));
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  const isSignup = mode === "signup";

  return (
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={!isSignup} onClick={() => switchMode("login")}>
          ログイン
        </button>
        <button type="button" role="tab" aria-selected={isSignup} onClick={() => switchMode("signup")}>
          新規登録
        </button>
      </div>

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

      <label className="field">
        <span className="field-label">パスワード</span>
        <input
          className="input"
          type="password"
          required
          minLength={isSignup ? PASSWORD_RULE.min : undefined}
          maxLength={PASSWORD_RULE.max}
          autoComplete={isSignup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {isSignup && <span className="field-hint">{PASSWORD_RULE.min}文字以上</span>}
      </label>

      {isSignup && (
        <label className="field">
          <span className="field-label">パスワード（確認）</span>
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

      {error && <p className="form-error">{error}</p>}

      <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={submitting}>
        {submitting ? "送信中…" : isSignup ? "登録してはじめる" : "ログイン"}
      </button>
    </form>
  );
}
