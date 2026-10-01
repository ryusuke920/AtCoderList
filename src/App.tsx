import { useEffect, useState } from "react";
import type { User } from "../shared/domain";
import { api } from "./api";
import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { ProblemBoard } from "./components/ProblemBoard";

type AuthState = { status: "loading" } | { status: "ready"; user: User | null; devLogin: boolean };

export function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    api
      .me()
      .then(({ user, devLogin }) => setAuth({ status: "ready", user, devLogin }))
      .catch(() => setAuth({ status: "ready", user: null, devLogin: false }));
  }, []);

  const logout = async () => {
    await api.logout();
    setAuth((a) => (a.status === "ready" ? { ...a, user: null } : a));
  };

  if (auth.status === "loading") return <div className="splash" aria-busy="true" />;

  return (
    <>
      <Header user={auth.user} onLogout={logout} />
      <main>{auth.user ? <ProblemBoard /> : <Landing devLogin={auth.devLogin} />}</main>
    </>
  );
}
