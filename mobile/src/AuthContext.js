import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, clearSession, loadSession, saveSession, setToken, setUnauthorizedHandler } from "./api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(async () => {
    setToken(null);
    await clearSession();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    (async () => {
      const s = await loadSession();
      if (s?.token) { setToken(s.token); setUser(s.user); }
      setReady(true);
    })();
  }, [logout]);

  const login = async (email, password) => {
    const r = await api.post("/auth/login", { email: email.trim(), password });
    setToken(r.token);
    await saveSession(r.token, r.user);
    setUser(r.user);
  };

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}
