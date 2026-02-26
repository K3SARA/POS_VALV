import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./api";
import { formatNumber } from "./utils/format";
import { useNavigate } from "react-router-dom";
import TopNav from "./TopNav";

export default function CustomerWiseReport() {
  const navigate = useNavigate();
  const reportsMenuRef = useRef(null);
  const stockMenuRef = useRef(null);
  const [showReportsMenu, setShowReportsMenu] = useState(false);
  const [showStockMenu, setShowStockMenu] = useState(false);
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState("outstanding");
  const [sortDir, setSortDir] = useState("desc");

  const doLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const load = async () => {
    setMsg("");
    setLoading(true);
    try {
      const data = await apiFetch("/reports/customer-outstanding");
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e) {
      setMsg("Error: " + e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
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

  const sortedRows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "outstanding" || sortKey === "totalBillValue") {
        return (Number(a?.[sortKey] || 0) - Number(b?.[sortKey] || 0)) * dir;
      }
      return String(a?.[sortKey] || "")
        .toLowerCase()
        .localeCompare(String(b?.[sortKey] || "").toLowerCase()) * dir;
    });
  }, [rows, sortKey, sortDir]);

  const totalOutstanding = rows.reduce((sum, r) => sum + Number(r.outstanding || 0), 0);
  const totalBillValue = rows.reduce((sum, r) => sum + Number(r.totalBillValue || 0), 0);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "outstanding" ? "desc" : "asc");
    }
  };

  return (
    <div className="page">
      <TopNav
        onLogout={doLogout}
        title="Customer-wise Report | Apex Logistics"
        subtitle="Minimal control center for your POS"
      />

      <div className="panel" style={{ marginTop: 12, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Summary</h3>
          <button className="btn secondary" type="button" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        <div style={{ lineHeight: 1.9 }}>
          <div>Customers with outstanding: <b>{rows.length}</b></div>
          <div>Total outstanding: <b>Rs {formatNumber(totalOutstanding)}</b></div>
          <div>Total bill value: <b>Rs {formatNumber(totalBillValue)}</b></div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12, padding: 14 }}>
        <h3 style={{ margin: 0 }}>Outstanding by Customer</h3>
        {msg ? <div style={{ color: "crimson", marginBottom: 10 }}>{msg}</div> : null}

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="table-sortable-th" data-sort-dir={sortKey === "name" ? sortDir : undefined} onClick={() => toggleSort("name")} style={{ borderBottom: "1px solid #000", textAlign: "left", padding: 10, color: "#000" }}>Customer</th>
              <th className="table-sortable-th" data-sort-dir={sortKey === "phone" ? sortDir : undefined} onClick={() => toggleSort("phone")} style={{ borderBottom: "1px solid #000", textAlign: "left", padding: 10, color: "#000" }}>Phone</th>
              <th className="table-sortable-th" data-sort-dir={sortKey === "address" ? sortDir : undefined} onClick={() => toggleSort("address")} style={{ borderBottom: "1px solid #000", textAlign: "left", padding: 10, color: "#000" }}>Address</th>
              <th className="table-sortable-th" data-sort-dir={sortKey === "outstanding" ? sortDir : undefined} onClick={() => toggleSort("outstanding")} style={{ borderBottom: "1px solid #000", textAlign: "right", padding: 10, color: "#000" }}>Outstanding</th>
              <th className="table-sortable-th" data-sort-dir={sortKey === "totalBillValue" ? sortDir : undefined} onClick={() => toggleSort("totalBillValue")} style={{ borderBottom: "1px solid #000", textAlign: "right", padding: 10, color: "#000" }}>Total Bill Value</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((c) => (
              <tr key={c.customerId}>
                <td style={{ borderBottom: "1px solid #f1f1f1", padding: 10 }}>{c.name || "-"}</td>
                <td style={{ borderBottom: "1px solid #f1f1f1", padding: 10 }}>{c.phone || "-"}</td>
                <td style={{ borderBottom: "1px solid #f1f1f1", padding: 10 }}>{c.address || "-"}</td>
                <td style={{ borderBottom: "1px solid #f1f1f1", padding: 10, textAlign: "right" }}>Rs {formatNumber(c.outstanding || 0)}</td>
                <td style={{ borderBottom: "1px solid #f1f1f1", padding: 10, textAlign: "right" }}>Rs {formatNumber(c.totalBillValue || 0)}</td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: 16, textAlign: "center" }}>No outstanding customers</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}




