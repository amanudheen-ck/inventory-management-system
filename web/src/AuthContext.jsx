import { createContext, useContext, useState } from "react";
import { api } from "./api.js";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });

  const login = async (email, password) => {
    const r = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", r.token);
    localStorage.setItem("user", JSON.stringify(r.user));
    setUser(r.user);
  };
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };
  const can = (...roles) => !!user && roles.includes(user.role);

  return <Ctx.Provider value={{ user, login, logout, can }}>{children}</Ctx.Provider>;
}
