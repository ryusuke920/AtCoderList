import { useEffect, useState } from "react";
import type { User } from "../shared/domain";
import { api } from "./api";
import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { ProblemBoard } from "./components/ProblemBoard";
import { SettingsDialog } from "./components/SettingsDialog";

export function App() {
  // undefined: 読み込み中, null: 未ログイン
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    api.me().then(setUser, () => setUser(null));
  }, []);

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  if (user === undefined) return <div className="splash" aria-busy="true" />;

  return (
    <>
      <Header user={user} onLogout={logout} onOpenSettings={() => setSettingsOpen(true)} />
      <main>
        {user ? (
          // AtCoder ID が変わったら一覧（と自動同期）を作り直す
          <ProblemBoard key={user.atcoderId ?? ""} user={user} onUserChange={setUser} onOpenSettings={() => setSettingsOpen(true)} />
        ) : (
          <Landing onAuthenticated={setUser} />
        )}
      </main>
      <footer className="footer">
        AtCoder List は個人が運営する非公式ツールで、AtCoder 株式会社とは関係ありません。問題の情報は{" "}
        <a href="https://atcoder.jp" target="_blank" rel="noreferrer">
          AtCoder
        </a>
        、提出データは{" "}
        <a href="https://github.com/kenkoooo/AtCoderProblems" target="_blank" rel="noreferrer">
          AtCoder Problems
        </a>{" "}
        を利用しています。
      </footer>
      {user && settingsOpen && <SettingsDialog
          user={user}
          onSaved={setUser}
          onDeleted={() => {
            setSettingsOpen(false);
            setUser(null);
          }}
          onClose={() => setSettingsOpen(false)}
        />}
    </>
  );
}
