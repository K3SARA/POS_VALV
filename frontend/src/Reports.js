import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api";
import { useNavigate } from "react-router-dom";

function formatDate(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export default function Reports() {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // default: today
  const [from, setFrom] = useState(formatDate(new Date()));
  const [to, setTo] = useState(formatDate(new Date()));

  const loadSales = async () => {
    setMsg("");
    try {
      setLoading(true);
      const data = await apiFetch("/sales");
      setSales(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg("❌ " + e.message);
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  // Filter by date range (uses createdAt if available)
  const filtered = useMemo(() => {
    const fromD = new Date(from + "T00:00:00");
    const toD = new Date(to + "T23:59:59");

    return sales.filter((s) => {
      if (!s.createdAt) return true; // if no createdAt, can't filter, include
      const d = new Date(s.createdAt);
      return d >= fromD && d <= toD;
    });
  }, [sales, from, to]);

  const totals = useMemo(() => {
    const billCount = filtered.length;
    const totalSales = filtered.reduce((sum, s) => sum + Number(s.total || 0), 0);

    const totalItems = filtered.reduce((sum, s) => {
      const items = s.saleItems || [];
      return sum + items.reduce((a, i) => a + Number(i.qty || 0), 0);
    }, 0);

    return { billCount, totalSales, totalItems };
  }, [filtered]);

  return (
    <div style={{ fontFamily: "Arial", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0 }}>📊 Reports</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate(-1)} style={{ padding: 10 }}>
            Back
          </button>
          <button onClick={loadSales} disabled={loading} style={{ padding: 10 }}>
            Refresh
          </button>
        </div>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <div style={{ marginTop: 15, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>Date Range</h3>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#555" }}>From</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: 8 }} />
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#555" }}>To</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: 8 }} />
          </div>

          {!sales.some((s) => s.createdAt) && (
            <div style={{ color: "#b45309", fontSize: 13 }}>
              Note: Your sales don’t have <b>createdAt</b> in DB yet, so date filtering may not work perfectly.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 15, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>Summary</h3>
        <div style={{ lineHeight: 1.8 }}>
          <div>Bills count: <b>{totals.billCount}</b></div>
          <div>Total items sold: <b>{totals.totalItems}</b></div>
          <div>Total sales: <b>{totals.totalSales}</b></div>
        </div>
      </div>

      <div style={{ marginTop: 15, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>Sales List</h3>

        {filtered.length === 0 ? (
          <p style={{ color: "#666" }}>No sales in this range.</p>
        ) : (
          <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Sale ID</th>
                <th>Date</th>
                <th>Total</th>
                <th>Items Count</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.createdAt ? new Date(s.createdAt).toLocaleString() : "-"}</td>
                  <td>{s.total}</td>
                  <td>{(s.saleItems || []).reduce((a, i) => a + Number(i.qty || 0), 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
