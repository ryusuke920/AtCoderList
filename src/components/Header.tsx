import type { User } from "../../shared/domain";

export function Header({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  return (
    <header className="header">
      <a href="/" className="logo">
        <img src="/favicon.ico" alt="" width={28} height={28} />
        AtCoder List
      </a>
      {user && (
        <div className="header-user">
          {user.avatarUrl && <img className="avatar" src={user.avatarUrl} alt="" width={28} height={28} />}
          <span className="header-username">{user.username}</span>
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            ログアウト
          </button>
        </div>
      )}
    </header>
  );
}
