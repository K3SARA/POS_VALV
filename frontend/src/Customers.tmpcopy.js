import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api";
import { formatNumber } from "./utils/format";


export default function Customers() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [outstandingMap, setOutstandingMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [viewRow, setViewRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", address: "" });
  const [showReportsMenu, setShowReportsMenu] = useState(false);
  const [showStockMenu, setShowStockMenu] = useState(false);
  const reportsMenuRef = React.useRef(null);
  const stockMenuRef = React.useRef(null);
  const customerImportInputRef = React.useRef(null);

  const doLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setMsg("");
      const [customers, outstanding] = await Promise.all([
        apiFetch("/customers/all"),
        apiFetch("/reports/customer-outstanding"),
      ]);
      setRows(Array.isArray(customers) ? customers : []);
      const map = {};
      (outstanding?.rows || []).forEach((r) => {
        if (r?.customerId) map[r.customerId] = Number(r.outstanding || 0);
      });
      setOutstandingMap(map);
    } catch (e) {
      setMsg("Error: " + e.message);
      setRows([]);
      setOutstandingMap({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
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

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const sortedRows = useMemo(() => {
    const data = [...rows];
    data.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a?.[sortKey];
      const bv = b?.[sortKey];
      if (sortKey === "createdAt") {
        const ad = av ? new Date(av).getTime() : 0;
        const bd = bv ? new Date(bv).getTime() : 0;
        return (ad - bd) * dir;
      }
      if (sortKey === "outstanding") {
        return (Number(outstandingMap[a.id] || 0) - Number(outstandingMap[b.id] || 0)) * dir;
      }
      return String(av || "").localeCompare(String(bv || "")) * dir;
    });
    return data;
  }, [rows, sortKey, sortDir, outstandingMap]);

  const openEdit = (c) => {
    setEditRow(c);
    setEditForm({
      name: c.name || "",
      phone: c.phone || "",
      address: c.address || "",
    });
  };

  const saveEdit = async () => {
    if (!editRow) return;
    try {
      setLoading(true);
      await apiFetch(`/customers/${editRow.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone,
          address: editForm.address,
        }),
      });
      setEditRow(null);
      await loadCustomers();
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomer = async (id) => {
    if (!window.confirm("Delete this customer?")) return;
    try {
      setLoading(true);
      await apiFetch(`/customers/${id}`, { method: "DELETE" });
      await loadCustomers();
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const sortLabel = (key, label) => `${label}${sortKey === key ? (sortDir === "asc" ? " ????????" : " ????????") : ""}`;

  return (
    <div className="admin-shell">
      <style>{`
        .admin-shell { min-height: 100vh; padding: 24px 20px 40px; color: var(--text); background: var(--bg); }
        .admin-content { max-width: 1200px; margin: 0 auto; }
        .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
        .btn { border: none; border-radius: 10px; padding: 9px 14px; font-weight: 600; cursor: pointer; background: var(--accent); color: var(--bg); }
        .btn.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
        .btn.secondary { background: var(--panel); border: 1px solid var(--border); color: var(--text); }
        .btn.danger { background: #dc2626; color: #fff; border: 1px solid #b91c1c; }
        .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
        .banner { background: var(--panel); border: 1px solid var(--border); padding: 10px 14px; border-radius: 10px; font-weight: 600; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        thead th { text-align: left; padding: 10px; background: rgba(255, 255, 255, 0.04); border-bottom: 1px solid var(--border); cursor: pointer; user-select: none; }
        tbody td { padding: 10px; border-bottom: 1px solid var(--border); }
        tbody tr:hover { background: #ffffff; color: #000000; }
        tbody tr:hover td { color: #000000; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 9999; }
        .modal { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px; width: min(520px, 100%); }
        .modal input { width: 100%; margin-top: 6px; margin-bottom: 10px; padding: 9px 10px; border-radius: 8px; border: 1px solid var(--border); background: #fff; color: #000; }
      `}</style>

      <div className="admin-content">
        <h2 style={{ marginTop: 0 }}>Customers</h2>
        <div className="actions print-hide">
          <button className="btn ghost" onClick={() => navigate("/admin")}>???? Home</button>
          <div ref={reportsMenuRef} style={{ position: "relative" }}>
            <button className="btn ghost" onClick={() => setShowReportsMenu((v) => !v)}>Reports</button>
            {showReportsMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, display: "grid", gap: 6, padding: 8, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 50, minWidth: 170 }}>
                <button className="btn secondary" onClick={() => { setShowReportsMenu(false); navigate("/reports"); }}>Sales Reports</button>
                <button className="btn secondary" onClick={() => { setShowReportsMenu(false); navigate("/reports/items"); }}>Item-wise Report</button>
              </div>
            )}
          </div>
          <button className="btn ghost" onClick={() => navigate("/returns")}>Returns</button>
          <div ref={stockMenuRef} style={{ position: "relative" }}>
            <button className="btn ghost" onClick={() => setShowStockMenu((v) => !v)}>Stock</button>
            {showStockMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, display: "grid", gap: 6, padding: 8, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 50, minWidth: 170 }}>
                <button className="btn secondary" onClick={() => { setShowStockMenu(false); navigate("/stock"); }}>Current Stock</button>
                <button className="btn secondary" onClick={() => { setShowStockMenu(false); navigate("/stock/returned"); }}>Returned Stock</button>
              </div>
            )}
          </div>
          <button className="btn ghost" onClick={() => navigate("/customers")}>Customers</button>
          <button className="btn secondary" onClick={() => navigate("/end-day")}>End Day</button>
          <button className="btn ghost" onClick={() => navigate("/billing")}>Billing</button>
          <button className="btn danger" onClick={doLogout}>Logout</button>
        </div>

        {msg && <div className="banner">{msg}</div>}

        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Customer Table</h3>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>Click headers to sort ascending/descending</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn secondary print-hide" onClick={() => window.print()}>Print</button>
              <button className="btn secondary print-hide" onClick={loadCustomers} disabled={loading}>Refresh</button>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th onClick={() => toggleSort("id")}>{sortLabel("id", "Customer ID")}</th>
                <th onClick={() => toggleSort("name")}>{sortLabel("name", "Customer Name")}</th>
                <th onClick={() => toggleSort("phone")}>{sortLabel("phone", "Phone")}</th>
                <th onClick={() => toggleSort("address")}>{sortLabel("address", "Address")}</th>
                <th onClick={() => toggleSort("outstanding")}>{sortLabel("outstanding", "Outstanding")}</th>
                <th onClick={() => toggleSort("createdAt")}>{sortLabel("createdAt", "Created")}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((c) => (
                <tr key={c.id}>
                  <td>{formatNumber(c.id)}</td>
                  <td>{c.name}</td>
                  <td>{c.phone || "-"}</td>
                  <td>{c.address || "-"}</td>
                  <td>{Number(outstandingMap[c.id] || 0) > 0 ? formatNumber(outstandingMap[c.id]) : "-"}</td>
                  <td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "-"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn secondary print-hide" onClick={() => setViewRow(c)}>View</button>
                      <button className="btn secondary print-hide" onClick={() => openEdit(c)}>Edit</button>
                      <button className="btn ghost print-hide" onClick={() => deleteCustomer(c.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: 16 }}>{loading ? "Loading..." : "No customers found"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewRow && (
        <div className="overlay" onClick={() => setViewRow(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Customer Details</h3>
            <div><b>ID:</b> {viewRow.id}</div>
            <div><b>Name:</b> {viewRow.name}</div>
            <div><b>Phone:</b> {viewRow.phone || "-"}</div>
            <div><b>Address:</b> {viewRow.address || "-"}</div>
            <div><b>Created:</b> {viewRow.createdAt ? new Date(viewRow.createdAt).toLocaleString() : "-"}</div>
            <div style={{ marginTop: 12, textAlign: "right" }}>
              <button className="btn" onClick={() => setViewRow(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {editRow && (
        <div className="overlay" onClick={() => setEditRow(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Edit Customer</h3>
            <label>Name</label>
            <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
            <label>Phone</label>
            <input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
            <label>Address</label>
            <input value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn secondary" onClick={() => setEditRow(null)}>Cancel</button>
              <button className="btn" onClick={saveEdit} disabled={loading}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




