import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api";

export default function Login({ onLogin }) {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErrMsg("");
    setLoading(true);

    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);

      onLogin(); // refresh App
      navigate("/", { replace: true }); // ✅ redirect out of /login
    } catch (err) {
      setErrMsg(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        fontFamily: "Arial",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f5f5f5",
      }}
    >
      <div
        style={{
          width: 360,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 10,
          background: "white",
        }}
      >
        <h2 style={{ marginTop: 0 }}>🔐 POS Login</h2>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <label>Username</label>
            <input
              style={{ width: "100%", padding: 10, marginTop: 6 }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin / cashier1"
              autoComplete="username"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Password</label>
            <input
              style={{ width: "100%", padding: 10, marginTop: 6 }}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
            />
          </div>

          {errMsg && (
            <div style={{ marginBottom: 12, color: "crimson" }}>{errMsg}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 12,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
          Tip: login as <b>admin</b> to manage products/users. Cashier can do
          sales.
        </p>
      </div>
    </div>
  );
}
