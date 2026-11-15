import * as SecureStore from "expo-secure-store";

const BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
let token = null;
let onUnauthorized = () => {};

export const setToken = (t) => { token = t; };
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };
export const saveSession = (t, user) => SecureStore.setItemAsync("session", JSON.stringify({ token: t, user }));
export const clearSession = () => SecureStore.deleteItemAsync("session");
export const loadSession = async () => {
  try { return JSON.parse(await SecureStore.getItemAsync("session")); } catch { return null; }
};

async function request(method, path, body) {
  let res;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000); // do not hang forever
  try {
    res = await fetch(BASE + path, {
      signal: ctrl.signal,
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Cannot reach the server at ${BASE}. Check Wi-Fi, the IP address and the firewall.`);
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onUnauthorized(); // token expired or user deactivated
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

export const api = { get: (p) => request("GET", p), post: (p, b) => request("POST", p, b) };
