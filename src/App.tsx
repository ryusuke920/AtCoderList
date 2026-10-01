import { useEffect, useState } from "react";
import type { User } from "../shared/domain";
import { api } from "./api";
import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { ProblemBoard } from "./components/ProblemBoard";

export function App() {
  // undefined: 読み込み中, null: 未ログイン
  const [user, setUser] = useState<User | null | undefined>(undefined);

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
      <Header user={user} onLogout={logout} />
      <main>{user ? <ProblemBoard /> : <Landing onAuthenticated={setUser} />}</main>
    </>
  );
}
