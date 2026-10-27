'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, tokenStore } from './api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tokenStore.get()) { setReady(true); return; }
    api('/auth/me').then((r) => setUser(r.user)).catch(() => tokenStore.clear()).finally(() => setReady(true));
  }, []);

  const authenticate = async (path, body) => {
    const r = await api(path, { method: 'POST', body });
    tokenStore.set(r.token);
    setUser(r.user);
  };
  const login = (email, password) => authenticate('/auth/login', { email, password });
  const register = (name, email, password) => authenticate('/auth/register', { name, email, password });
  const logout = () => { tokenStore.clear(); setUser(null); };

  return <AuthCtx.Provider value={{ user, ready, login, register, logout }}>{children}</AuthCtx.Provider>;
}

/** Redirects to /login when not signed in. */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => { if (auth.ready && !auth.user) router.replace('/login'); }, [auth.ready, auth.user, router]);
  return auth;
}
