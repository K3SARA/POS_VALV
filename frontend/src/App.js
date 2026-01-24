import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./login";
import Cashier from "./Cashier";
import AdminDashboard from "./AdminDashboard";
import { getToken, getRole } from "./api";

import SalesHistory from "./SalesHistory";
import Reports from "./Reports";
import EndDay from "./EndDay";




function PrivateRoute({ children, allow }) {
  const token = getToken();
  const role = getRole();

  if (!token) return <Navigate to="/login" replace />;
  if (allow && role !== allow) {
    return <Navigate to={role === "admin" ? "/admin" : "/cashier"} replace />;
  }
  return children;
}

export default function App() {
  const [, setTick] = useState(0);
  const refresh = () => setTick((x) => x + 1);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    refresh();
  };

  const role = getRole();
  const token = getToken();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/history" element={<SalesHistory />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/end-day" element={<EndDay />} />



        <Route path="/login" element={<Login onLogin={refresh} />} />

        <Route
          path="/"
          element={
            token ? (
              <Navigate to={role === "admin" ? "/admin" : "/cashier"} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/admin"
          element={
            <PrivateRoute allow="admin">
              <AdminDashboard onLogout={logout} />
            </PrivateRoute>
          }
        />

        <Route
          path="/cashier"
          element={
            <PrivateRoute allow="cashier">
              <Cashier onLogout={logout} />
            </PrivateRoute>
          }
        />

        {/* Fallback: if route doesn't match */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
