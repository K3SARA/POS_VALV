import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, clearSession, getRole, getToken, setSession } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [savedToken, savedRole] = await Promise.all([getToken(), getRole()]);
      setToken(savedToken);
      setRole(savedRole);
      setLoading(false);
    }

    load();
  }, []);

  async function login(username, password) {
    let data;
    try {
      data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
    } catch (error) {
      await apiFetch("/auth/setup-admin", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
    }

    const nextRole = data?.user?.role || data?.role;
    if (!data?.token || !nextRole) {
      throw new Error("Invalid login response");
    }

    await setSession(data.token, nextRole);
    setToken(data.token);
    setRole(nextRole);
  }

  async function logout() {
    await clearSession();
    setToken(null);
    setRole(null);
  }

  const value = useMemo(
    () => ({
      token,
      role,
      loading,
      login,
      logout,
      isAuthed: Boolean(token),
    }),
    [token, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
