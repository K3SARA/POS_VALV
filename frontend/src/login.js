import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api"; // if your api file path differs, change it

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");

    try {
      const login = async () =>
        apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });

      let data;
      try {
        data = await login();
      } catch (err) {
        // auto-create first admin if no users exist, then retry login once
        try {
          await apiFetch("/auth/setup-admin", {
            method: "POST",
            body: JSON.stringify({ username, password }),
          });
          data = await login();
        } catch {
          throw err;
        }
      }

      localStorage.setItem("token", data.token);

      const role = data.user?.role ?? data.role;
      if (!role) throw new Error("Role missing from login response");
      localStorage.setItem("role", role);

      onLogin?.();
      navigate(role === "admin" ? "/admin" : "/cashier", { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed");
    }
  }

  return (
    <div className="login-shell">
      <div className="login-matte-layer" aria-hidden>
        <div className="login-blob login-blob-a" />
        <div className="login-blob login-blob-b" />
        <div className="login-blob login-blob-c" />
      </div>

      <div className="login-inner">
        <div className="login-title-wrap">
          <h1 className="login-brand">Apex Logistics</h1>
          <p className="login-sub">Fast, simple, reliable POS access</p>
        </div>

        <div className="login-card">
          <form onSubmit={submit}>
            <div className="login-field">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
              />
            </div>

            <div className="login-field">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />
            </div>

            {error ? <div className="login-error">{error}</div> : null}

            <button className="login-btn" type="submit">Login</button>
          </form>
        </div>

        <div className="login-logo-card">
          <div className="login-logo-row">
            <img src="/valvoline.png" alt="Valvoline" className="login-partner-logo" />
            <div className="login-logo-divider" />
            <img src="/soft.png" alt="Soft" className="login-partner-logo" />
          </div>
        </div>

        <div className="login-powered">
          Powered by{" "}
          <a href="https://jncosoftwaresolutions.pages.dev/" target="_blank" rel="noreferrer">
            J&co.
          </a>
        </div>
      </div>
    </div>
  );
}
