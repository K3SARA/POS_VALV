import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./api";
import { formatNumber } from "./utils/format";
import { useNavigate } from "react-router-dom";
import TopNav from "./TopNav";


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
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

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
      <TopNav onLogout={doLogout} />
      <h2 style={{ marginTop: 12 }}>Item-wise Report</h2>

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
              <th className="table-sortable-th" data-sort-dir={sortKey === "barcode" ? sortDir : undefined} onClick={() => { if (sortKey === "barcode") setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey("barcode"); setSortDir("asc"); } }} style={{ borderBottom: "1px solid #000000", textAlign: "left", padding: 10, color: "#000000" }}>Barcode</th>
              <th className="table-sortable-th" data-sort-dir={sortKey === "name" ? sortDir : undefined} onClick={() => { if (sortKey === "name") setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey("name"); setSortDir("asc"); } }} style={{ borderBottom: "1px solid #000000", textAlign: "left", padding: 10, color: "#000000" }}>Item</th>
              <th className="table-sortable-th" data-sort-dir={sortKey === "qty" ? sortDir : undefined} onClick={() => { if (sortKey === "qty") setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey("qty"); setSortDir("asc"); } }} style={{ borderBottom: "1px solid #0a0a0a", textAlign: "right", padding: 10, color: "#000000" }}>Qty</th>
              <th className="table-sortable-th" data-sort-dir={sortKey === "total" ? sortDir : undefined} onClick={() => { if (sortKey === "total") setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey("total"); setSortDir("asc"); } }} style={{ borderBottom: "1px solid #000000", textAlign: "right", padding: 10, color: "#000000" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].sort((a, b) => { const d = sortDir === "asc" ? 1 : -1; if (sortKey === "qty" || sortKey === "total") return (Number(a?.[sortKey] || 0) - Number(b?.[sortKey] || 0)) * d; return String(a?.[sortKey] || "").toLowerCase().localeCompare(String(b?.[sortKey] || "").toLowerCase()) * d; }).map((r, idx) => (
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




