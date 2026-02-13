import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, clearSession, getRole, getToken, getUsername, setSession } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [savedToken, savedRole, savedUsername] = await Promise.all([getToken(), getRole(), getUsername()]);
      setToken(savedToken);
      setRole(savedRole);
      setUsername(savedUsername || "");
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
    const nextUsername = data?.user?.username || username;
    if (!data?.token || !nextRole) {
      throw new Error("Invalid login response");
    }

    await setSession(data.token, nextRole, nextUsername);
    setToken(data.token);
    setRole(nextRole);
    setUsername(nextUsername || "");
  }

  async function logout() {
    await clearSession();
    setToken(null);
    setRole(null);
    setUsername("");
  }

  const value = useMemo(
    () => ({
      token,
      role,
      username,
      loading,
      login,
      logout,
      isAuthed: Boolean(token),
    }),
    [token, role, username, loading]
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
