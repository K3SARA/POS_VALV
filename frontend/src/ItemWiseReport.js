import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./api";
import { formatNumber } from "./utils/format";
import { useNavigate } from "react-router-dom";


function toDateInputValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function ItemWiseReport() {
  const navigate = useNavigate();
  const reportsMenuRef = useRef(null);
  const stockMenuRef = useRef(null);
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(toDateInputValue(today));
  const [to, setTo] = useState(toDateInputValue(today));
  const [showReportsMenu, setShowReportsMenu] = useState(false);
  const [showStockMenu, setShowStockMenu] = useState(false);
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  };

  async function load() {
    setMsg("");
    setLoading(true);
    try {
      const data = await apiFetch(`/reports/items?from=${from}&to=${to}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg("Error: " + e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onDocClick = (event) => {
      if (reportsMenuRef.current && !reportsMenuRef.current.contains(event.target)) {
        setShowReportsMenu(false);
      }
      if (stockMenuRef.current && !stockMenuRef.current.contains(event.target)) {
        setShowStockMenu(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const totalQty = rows.reduce((a, r) => a + Number(r.qty || 0), 0);
  const totalSales = rows.reduce((a, r) => a + Number(r.total || 0), 0);

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Item-wise Report</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn ghost" type="button" onClick={() => navigate("/admin")}>
            Home
          </button>
          <div ref={reportsMenuRef} style={{ position: "relative" }}>
            <button className="btn ghost" type="button" onClick={() => setShowReportsMenu((v) => !v)}>
              Reports
            </button>
            {showReportsMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, display: "grid", gap: 6, padding: 8, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 50, minWidth: 170 }}>
                <button className="btn secondary" type="button" onClick={() => { setShowReportsMenu(false); navigate("/reports"); }}>
                  Sales Reports
                </button>
                <button className="btn secondary" type="button" onClick={() => { setShowReportsMenu(false); navigate("/reports/items"); }}>
                  Item-wise Report
                </button>
              </div>
            )}
          </div>
          <button className="btn ghost" type="button" onClick={() => navigate("/returns")}>
            Returns
          </button>
          <div ref={stockMenuRef} style={{ position: "relative" }}>
            <button className="btn ghost" type="button" onClick={() => setShowStockMenu((v) => !v)}>
              Stock
            </button>
            {showStockMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, display: "grid", gap: 6, padding: 8, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 50, minWidth: 170 }}>
                <button className="btn secondary" type="button" onClick={() => { setShowStockMenu(false); navigate("/stock"); }}>
                  Current Stock
                </button>
                <button className="btn secondary" type="button" onClick={() => { setShowStockMenu(false); navigate("/stock/returned"); }}>
                  Returned Stock
                </button>
              </div>
            )}
          </div>
          <button className="btn ghost" type="button" onClick={() => navigate("/customers")}>
            Customers
          </button>
          <button className="btn secondary" type="button" onClick={() => navigate("/end-day")}>
            End Day
          </button>
          <button className="btn ghost" type="button" onClick={() => navigate("/billing")}>
            Billing
          </button>
          <button className="btn" type="button" onClick={doLogout} style={{ background: "#dc2626", color: "#fff", border: "1px solid #b91c1c" }}>
            Logout
          </button>
          <button className="btn secondary" type="button" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Date Range</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>From</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>To</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="btn" type="button" onClick={load} disabled={loading}>
            Load
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Summary</h3>
        <div style={{ lineHeight: 1.9 }}>
          <div>Total items sold (qty): <b>{totalQty}</b></div>
          <div>Total sales: <b>Rs {formatNumber(totalSales)}</b></div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Items</h3>
        {msg ? <div style={{ color: "crimson", marginBottom: 10 }}>{msg}</div> : null}

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 10 }}>Barcode</th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 10 }}>Item</th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "right", padding: 10 }}>Qty</th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "right", padding: 10 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx}>
                <td style={{ borderBottom: "1px solid #f1f1f1", padding: 10 }}>{r.barcode || "-"}</td>
                <td style={{ borderBottom: "1px solid #f1f1f1", padding: 10 }}>{r.name || "-"}</td>
                <td style={{ borderBottom: "1px solid #f1f1f1", padding: 10, textAlign: "right" }}>
                  {formatNumber(r.qty || 0)}
                </td>
                <td style={{ borderBottom: "1px solid #f1f1f1", padding: 10, textAlign: "right" }}>
                  Rs {formatNumber(r.total || 0)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan="4" style={{ padding: 16, textAlign: "center" }}>
                  No data for selected range
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

