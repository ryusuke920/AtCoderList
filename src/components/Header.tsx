import type { User } from "../../shared/domain";

type Props = { user: User | null; onLogout: () => void; onOpenSettings: () => void };

export function Header({ user, onLogout, onOpenSettings }: Props) {
  return (
    <header className="header">
      <a href="/" className="logo">
        <img src="/favicon.ico" alt="" width={28} height={28} />
        AtCoder List
      </a>
      {user && (
        <div className="header-user">
          <span className="header-username">{user.username}</span>
          <button type="button" className="btn btn-ghost" onClick={onOpenSettings}>
            設定
          </button>
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            ログアウト
          </button>
        </div>
      )}
    </header>
  );
}
