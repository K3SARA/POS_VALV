import React, { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { useNavigate } from "react-router-dom";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function EndDay() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayStr());
  const [summary, setSummary] = useState(null);
  const [closedList, setClosedList] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showStockMenu, setShowStockMenu] = useState(false);
  const stockMenuRef = React.useRef(null);

  const doLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const load = async () => {
    setMsg("");
    try {
      setLoading(true);
      const s = await apiFetch(`/reports/end-day?date=${encodeURIComponent(date)}`);
      setSummary(s);
      const list = await apiFetch("/reports/end-day/list");
      setClosedList(list);
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [date]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (stockMenuRef.current && !stockMenuRef.current.contains(event.target)) {
        setShowStockMenu(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const closeDay = async () => {
    try {
      setLoading(true);
      setMsg("");
      await apiFetch("/reports/end-day/close", {
        method: "POST",
        body: JSON.stringify({ date }),
      });
      setMsg("Day closed successfully");
      await load();
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0 }}>End Day (Daily Close)</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => navigate("/admin")} style={{ padding: 10 }}>🏠 Home</button>
          <button onClick={() => navigate("/reports")} style={{ padding: 10 }}>Reports</button>
          <button onClick={() => navigate("/returns")} style={{ padding: 10 }}>Returns</button>
          <div ref={stockMenuRef} style={{ position: "relative" }}>
            <button onClick={() => setShowStockMenu((v) => !v)} style={{ padding: 10 }}>Stock</button>
            {showStockMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, display: "grid", gap: 6, padding: 8, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 50, minWidth: 170 }}>
                <button onClick={() => { setShowStockMenu(false); navigate("/stock"); }} style={{ padding: 8 }}>Current Stock</button>
                <button onClick={() => { setShowStockMenu(false); navigate("/stock/returned"); }} style={{ padding: 8 }}>Returned Stock</button>
              </div>
            )}
          </div>
          <button onClick={() => navigate("/customers")} style={{ padding: 10 }}>Customers</button>
          <button onClick={() => navigate("/end-day")} style={{ padding: 10 }}>End Day</button>
          <button onClick={() => navigate("/billing")} style={{ padding: 10 }}>Billing</button>
          <button onClick={doLogout} style={{ padding: 10, background: "#dc2626", color: "#fff", border: "1px solid #b91c1c", borderRadius: 6 }}>Logout</button>
          <button onClick={load} disabled={loading} style={{ padding: 10 }}>Refresh</button>
        </div>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <div style={{ marginTop: 15, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>Select Date</h3>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: 8 }} />
      </div>

      <div style={{ marginTop: 15, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>Summary</h3>

        {!summary ? (
          <p style={{ color: "#666" }}>Loading...</p>
        ) : (
          <div style={{ lineHeight: 1.9 }}>
            <div>Bills count: <b>{summary.billCount}</b></div>
            <div>Total items sold: <b>{summary.totalItems}</b></div>
            <div>Total sales: <b>{summary.totalSales}</b></div>
            <div>Status: <b>{summary.alreadyClosed ? "Closed" : "Open"}</b></div>
            <button onClick={closeDay} disabled={loading || summary.alreadyClosed} style={{ marginTop: 10, padding: 12, fontSize: 16 }}>
              Close Day
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 15, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>Closed Days</h3>

        {closedList.length === 0 ? (
          <p style={{ color: "#666" }}>No closed days yet.</p>
        ) : (
          <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Bills</th>
                <th>Items</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {closedList.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.date).toISOString().slice(0, 10)}</td>
                  <td>{r.billCount}</td>
                  <td>{r.totalItems}</td>
                  <td>{r.totalSales}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
