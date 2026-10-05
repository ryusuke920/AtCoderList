import type { User } from "../../shared/domain";

type Props = { user: User | null; onLogout: () => void; onOpenSettings: () => void };

export function Header({ user, onLogout, onOpenSettings }: Props) {
  return (
    <header className="header">
      <a href="/" className="logo" aria-label="AtCoder List">
        <img src="/logo.png" alt="" width={28} height={28} />
        <span className="logo-text">AtCoder List</span>
      </a>
      <nav className="header-user">
        {user && <span className="header-username">{user.username}</span>}
        <a href="/guide" className="btn btn-ghost">
          使い方
        </a>
        {user && (
          <>
            <button type="button" className="btn btn-ghost" onClick={onOpenSettings}>
              設定
            </button>
            <button type="button" className="btn btn-ghost" onClick={onLogout}>
              ログアウト
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
