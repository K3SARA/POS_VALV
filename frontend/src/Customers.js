import React, { useEffect, useMemo, useState } from "react";
import TopNav from "./TopNav";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api";
import { formatNumber } from "./utils/format";
import Papa from "papaparse";


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
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", phone: "", address: "" });
  const [editForm, setEditForm] = useState({ customerId: "", name: "", phone: "", address: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [showReportsMenu, setShowReportsMenu] = useState(false);
  const [showStockMenu, setShowStockMenu] = useState(false);
  const reportsMenuRef = React.useRef(null);
  const stockMenuRef = React.useRef(null);
  const customerImportInputRef = React.useRef(null);
  const downloadCustomersCsv = () => {
    const headers = ["customerId", "name", "phone", "address", "outstanding", "createdAt"];
    const lines = [headers.join(",")];
    rows.forEach((c) => {
      const values = [
        c.id ?? "",
        c.name ?? "",
        c.phone ?? "",
        c.address ?? "",
        Number(outstandingMap[c.id] || 0),
        c.createdAt ? new Date(c.createdAt).toISOString() : "",
      ].map((v) => {
        const s = String(v ?? "");
        return s.includes(",") || s.includes("\"") || s.includes("\n")
          ? `"${s.replace(/\"/g, "\"\"")}"`
          : s;
      });
      lines.push(values.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const doLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  };
  const handleImportCustomers = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    setLoading(true);
    setMsg("");

    const parsed = await new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) =>
          String(h || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "")
            .replace(/_/g, ""),
        complete: (result) => resolve(result.data || []),
        error: reject,
      });
    });

    let created = 0, updated = 0, skipped = 0, failed = 0;

    for (const row of parsed) {
      const customerId = String(
        row.customerid ||
          row.customer_id ||
          row.customeridnumber ||
          row.id ||
          ""
      ).trim();
      const name = String(row.name || "").trim();
      const phone = String(row.phone || "").trim();
      const address = String(row.address || "").trim();

      if (!name) { skipped += 1; continue; }

      try {
        if (customerId) {
          let exists = false;
          try { await apiFetch(`/customers/${encodeURIComponent(customerId)}`); exists = true; } catch {}
          if (exists) {
            await apiFetch(`/customers/${encodeURIComponent(customerId)}`, {
              method: "PUT",
              body: JSON.stringify({ name, phone: phone || null, address: address || null }),
            });
            updated += 1;
          } else {
            await apiFetch("/customers", {
              method: "POST",
              body: JSON.stringify({ customerId, name, phone: phone || null, address: address || null }),
            });
            created += 1;
          }
        } else {
          await apiFetch("/customers", {
            method: "POST",
            body: JSON.stringify({ name, phone: phone || null, address: address || null }),
          });
          created += 1;
        }
      } catch {
        failed += 1;
      }
    }

    await loadCustomers();
    setMsg(`Import complete: ${created} created, ${updated} updated, ${skipped} skipped, ${failed} failed`);
  } catch (e) {
    setMsg("Error: " + e.message);
  } finally {
    setLoading(false);
  }
};


  const loadCustomers = async () => {
    try {
      setLoading(true);
      setMsg("");
      const [customers, outstanding] = await Promise.all([
        apiFetch("/customers/all"),
        apiFetch("/reports/customer-outstanding"),
      ]);
      setRows(Array.isArray(customers) ? customers.filter((c) => c?.isActive !== false) : []);
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
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? rows.filter((c) => {
          const id = String(c.id ?? "").toLowerCase();
          const name = String(c.name ?? "").toLowerCase();
          const phone = String(c.phone ?? "").toLowerCase();
          const address = String(c.address ?? "").toLowerCase();
          return id.includes(q) || name.includes(q) || phone.includes(q) || address.includes(q);
        })
      : rows;
    const data = [...filtered];
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
  }, [rows, sortKey, sortDir, outstandingMap, searchQuery]);

  const openEdit = (c) => {
    setEditRow(c);
    setEditForm({
      customerId: c.id || "",
      name: c.name || "",
      phone: c.phone || "",
      address: c.address || "",
    });
  };

  const digitsOnly = (v) => String(v || "").replace(/\D/g, "");
  const nameRegex = /^[A-Za-z0-9 .,&()'/-]{2,}$/;

  const saveEdit = async () => {
    if (!editRow) return;
    try {
      setLoading(true);
      await apiFetch(`/customers/${editRow.id}`, {
        method: "PUT",
        body: JSON.stringify({
          newCustomerId: editForm.customerId,
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

  const saveCreate = async () => {
    const name = String(createForm.name || "").trim();
    const phone = digitsOnly(createForm.phone);
    const address = String(createForm.address || "").trim();

    if (!nameRegex.test(name)) {
      setMsg("Error: Customer name is invalid");
      return;
    }
    if (phone.length !== 10) {
      setMsg("Error: Phone must be exactly 10 digits");
      return;
    }

    try {
      setLoading(true);
      setMsg("");
      await apiFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone,
          address: address || null,
        }),
      });
      setCreateOpen(false);
      setCreateForm({ name: "", phone: "", address: "" });
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

  const sortLabel = (key, label) => `${label}`;

  return (
    <div className="admin-shell">
      <style>{`
        .admin-shell { min-height: 100vh; padding: 24px 24px 40px; color: var(--text); background: var(--bg); }
        .admin-content { max-width: 1200px; margin: 0 auto; }
        .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
        .btn { border: none; border-radius: 10px; padding: 9px 14px; font-weight: 600; cursor: pointer; background: var(--accent); color: var(--bg); }
        .btn.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
        .btn.secondary { background: var(--panel); border: 1px solid var(--border); color: var(--text); }
        .btn.danger { background: #dc2626; color: #fff; border: 1px solid #b91c1c; }
        .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
        .banner { background: var(--panel); border: 1px solid var(--border); padding: 10px 14px; border-radius: 10px; font-weight: 600; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        thead th { text-align: left; padding: 10px; background: #000000 !important; color: #ffffff; border-bottom: 1px solid var(--border); cursor: pointer; user-select: none; opacity: 1; }
        tbody td { padding: 10px; border-bottom: 1px solid var(--border); }
        tbody tr:hover { background: #ffffff; color: #000000; }
        tbody tr:hover td { color: #000000; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 9999; }
        .modal { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px; width: min(520px, 100%); }
        .modal input { width: 100%; margin-top: 6px; margin-bottom: 10px; padding: 9px 10px; border-radius: 8px; border: 1px solid var(--border); background: #fff; color: #000; }
      `}</style>

      <div className="admin-content">
        <TopNav
          onLogout={doLogout}
          title="Customers | Apex Logistics"
          subtitle="Minimal control center for your POS"
        />

        {msg && <div className="banner">{msg}</div>}

        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span>Customer Table</span>
                <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>
                  ({formatNumber(rows.length)} customers)
                </span>
              </h3>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>Click headers to sort ascending/descending</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                placeholder="Search by ID, name, phone, address"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="btn secondary print-hide" onClick={() => setCreateOpen(true)} disabled={loading}>
                Create Customer
              </button>
              <button className="btn secondary print-hide" onClick={() => window.print()}>Print</button>
              <button className="btn secondary print-hide" onClick={downloadCustomersCsv} disabled={loading}>Export CSV</button>
              <button className="btn secondary print-hide" onClick={() => customerImportInputRef.current?.click()} disabled={loading}>Import Customers</button>
              <input ref={customerImportInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={handleImportCustomers} />
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
                  <td>{c.id ?? "-"}</td>
                  <td>{c.name}</td>
                  <td>{c.phone || "-"}</td>
                  <td>{c.address || "-"}</td>
                  <td>{Number(outstandingMap[c.id] || 0) > 0 ? formatNumber(outstandingMap[c.id]) : "-"}</td>
                  <td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "-"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn secondary print-hide" onClick={() => setViewRow(c)}>View</button>
                      <button className="btn secondary print-hide" onClick={() => openEdit(c)}>Edit</button>
                      <button className="btn secondary print-hide" onClick={() => deleteCustomer(c.id)}>Delete</button>
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

      {createOpen && (
        <div className="overlay" onClick={() => setCreateOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add Customer</h3>
            <label>Name</label>
            <input
              value={createForm.name}
              onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Customer name"
            />
            <label>Phone</label>
            <input
              value={createForm.phone}
              onChange={(e) => setCreateForm((p) => ({ ...p, phone: digitsOnly(e.target.value).slice(0, 10) }))}
              placeholder="10-digit phone"
              inputMode="numeric"
            />
            <label>Address</label>
            <input
              value={createForm.address}
              onChange={(e) => setCreateForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Address"
            />
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button
                className="btn"
                onClick={saveCreate}
                disabled={loading || digitsOnly(createForm.phone).length !== 10 || !nameRegex.test(String(createForm.name || "").trim())}
              >
                Save Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {editRow && (
        <div className="overlay" onClick={() => setEditRow(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Edit Customer</h3>
            <label>Customer ID</label>
            <input value={editForm.customerId} onChange={(e) => setEditForm((p) => ({ ...p, customerId: e.target.value }))} />
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









