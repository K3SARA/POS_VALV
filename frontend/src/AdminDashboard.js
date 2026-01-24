import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard({ onLogout }) {
  const navigate = useNavigate();
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [products, setProducts] = useState([]);
  const [productsTotal, setProductsTotal] = useState(0);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [summary, setSummary] = useState({
    totalProducts: 0,
    totalStock: 0,
    lowStock: 0,
    totalUsers: 0,
    todayBills: 0,
    todayRevenue: 0,
  });

  // Product form
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  // Product list controls
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [editingBarcode, setEditingBarcode] = useState(null);
  const [editValues, setEditValues] = useState({ name: "", price: "", stock: "" });
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // User form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("cashier");
  const [roleEdits, setRoleEdits] = useState({});
  const [fastMode, setFastMode] = useState(true);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);

  const loadSummary = useCallback(async () => {
    setMsg("");
    setLoading(true);
    try {
      const data = await apiFetch("/reports/summary");
      setSummary(data);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async (nextPage = 0) => {
    setMsg("");
    setLoading(true);
    try {
      const data = await apiFetch(`/products?limit=${pageSize}&offset=${nextPage * pageSize}`);
      setProducts(data.items || []);
      setProductsTotal(data.total || 0);
      setPage(nextPage);
      setProductsLoaded(true);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  const loadUsers = useCallback(async () => {
    setMsg("");
    setLoading(true);
    try {
      const data = await apiFetch("/users");
      setUsers(data);
      setUsersLoaded(true);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setMsg("");
    setLoading(true);
    try {
      const data = await apiFetch("/reports/analytics?days=30");
      setAnalytics(data);
      setAnalyticsLoaded(true);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!fastMode) {
      if (!productsLoaded) loadProducts(0);
      if (!usersLoaded) loadUsers();
      if (!analyticsLoaded) loadAnalytics();
    }
  }, [fastMode, productsLoaded, usersLoaded, analyticsLoaded, loadProducts, loadUsers, loadAnalytics]);

  const visibleProducts = useMemo(() => {
    const normalize = (v) => String(v ?? "").toLowerCase();
    const q = normalize(query);
    const filtered = products.filter((p) => {
      if (!q) return true;
      return normalize(p.name).includes(q) || normalize(p.barcode).includes(q);
    });

    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "name") {
        return normalize(a.name).localeCompare(normalize(b.name)) * dir;
      }
      const aNum = Number(String(a[sortBy] ?? "").replace(/,/g, "")) || 0;
      const bNum = Number(String(b[sortBy] ?? "").replace(/,/g, "")) || 0;
      return (aNum - bNum) * dir;
    });

    return sorted;
  }, [products, query, sortBy, sortDir]);

  const createProduct = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      await apiFetch("/products", {
        method: "POST",
        body: JSON.stringify({
          barcode,
          name,
          price: Number(price),
          stock: Number(stock || 0),
        }),
      });

      setMsg("Product created");
      setBarcode("");
      setName("");
      setPrice("");
      setStock("");
      await loadSummary();
      if (productsLoaded) {
        await loadProducts(page);
      }
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  const startEdit = (product) => {
    setEditingBarcode(product.barcode);
    setEditValues({
      name: product.name,
      price: product.price,
      stock: product.stock,
    });
  };

  const cancelEdit = () => {
    setEditingBarcode(null);
    setEditValues({ name: "", price: "", stock: "" });
  };

  const saveEdit = async (barcodeValue) => {
    try {
      await apiFetch(`/products/${barcodeValue}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editValues.name,
          price: Number(editValues.price),
          stock: Number(editValues.stock),
        }),
      });
      setMsg("Product updated");
      cancelEdit();
      await loadSummary();
      if (productsLoaded) {
        await loadProducts(page);
      }
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  const deleteProduct = async (barcodeValue) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await apiFetch(`/products/${barcodeValue}`, { method: "DELETE" });
      setMsg("Product deleted");
      await loadSummary();
      if (productsLoaded) {
        await loadProducts(page);
      }
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole,
        }),
      });
      setMsg("User created");
      setNewUsername("");
      setNewPassword("");
      setNewRole("cashier");
      await loadSummary();
      if (usersLoaded) {
        await loadUsers();
      }
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  const updateRole = async (userId) => {
    const role = roleEdits[userId];
    if (!role) return;
    try {
      await apiFetch(`/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      setMsg("Role updated");
      setRoleEdits((prev) => ({ ...prev, [userId]: undefined }));
      await loadSummary();
      if (usersLoaded) {
        await loadUsers();
      }
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Delete this user?")) return;
    try {
      await apiFetch(`/users/${userId}`, { method: "DELETE" });
      setMsg("User deleted");
      await loadSummary();
      if (usersLoaded) {
        await loadUsers();
      }
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  return (
    <div className="admin-shell">
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap");

        .admin-shell {
          font-family: "Space Grotesk", sans-serif;
          color: #0f172a;
          background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
          min-height: 100vh;
          padding: 24px 20px 40px;
        }

        .admin-content {
          max-width: 1200px;
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .title h2 {
          margin: 0;
          font-size: 26px;
        }

        .title span {
          font-size: 13px;
          color: #64748b;
        }

        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          border: none;
          border-radius: 10px;
          padding: 9px 14px;
          font-weight: 600;
          cursor: pointer;
          background: #0f172a;
          color: #fff;
          transition: transform 120ms ease, box-shadow 120ms ease;
        }

        .btn.secondary {
          background: #e2e8f0;
          color: #0f172a;
        }

        .btn.ghost {
          background: transparent;
          border: 1px solid #cbd5f5;
          color: #0f172a;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .banner {
          background: #0f172a;
          color: #fff;
          padding: 10px 14px;
          border-radius: 10px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
        }

        .card .label {
          color: #64748b;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .card .value {
          font-size: 18px;
          font-weight: 700;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .panel {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px;
        }

        .panel h3 {
          margin: 0 0 12px;
        }

        .form {
          display: grid;
          gap: 10px;
        }

        .input-group label {
          font-size: 12px;
          font-weight: 600;
          color: #334155;
        }

        .input-group input,
        .input-group select {
          width: 100%;
          padding: 9px 10px;
          margin-top: 6px;
          border-radius: 8px;
          border: 1px solid #cbd5f5;
          font-size: 14px;
        }

        .panel-wide {
          grid-column: 1 / -1;
        }

        .table-tools {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .table-tools input,
        .table-tools select {
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #cbd5f5;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        thead th {
          text-align: left;
          padding: 10px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        tbody td {
          padding: 10px;
          border-bottom: 1px solid #f1f5f9;
        }

        tbody tr:hover {
          background: #f8fafc;
        }

        @media (max-width: 640px) {
          .title h2 { font-size: 22px; }
          .panel-wide { grid-column: auto; }
        }
      `}</style>

      <div className="admin-content">
        <div className="topbar">
          <div className="title">
            <h2>Admin Dashboard</h2>
            <span>Minimal control center for your POS</span>
          </div>
          <div className="actions">
            <button className="btn ghost" onClick={() => navigate("/reports")}>Reports</button>
            <button className="btn secondary" onClick={() => navigate("/end-day")}>End Day</button>
            <button className="btn" onClick={onLogout}>Logout</button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <input
            id="fast-mode"
            type="checkbox"
            checked={fastMode}
            onChange={(e) => setFastMode(e.target.checked)}
          />
          <label htmlFor="fast-mode" style={{ fontSize: 12, color: "#475569" }}>
            Fast Mode (load heavy data only when needed)
          </label>
        </div>

        {msg && <div className="banner">{msg}</div>}

        <div className="cards">
          <div className="card">
            <div className="label">Total Products</div>
            <div className="value">{summary.totalProducts}</div>
          </div>
          <div className="card">
            <div className="label">Total Stock Units</div>
            <div className="value">{summary.totalStock}</div>
          </div>
          <div className="card">
            <div className="label">Low Stock Items</div>
            <div className="value">{summary.lowStock}</div>
          </div>
          <div className="card">
            <div className="label">Today Bills</div>
            <div className="value">{summary.todayBills}</div>
          </div>
          <div className="card">
            <div className="label">Today Revenue</div>
            <div className="value">{Math.round(summary.todayRevenue)}</div>
          </div>
          <div className="card">
            <div className="label">Total Users</div>
            <div className="value">{summary.totalUsers}</div>
          </div>
        </div>

        <div className="grid">
          <div className="panel panel-wide">
            <div className="table-tools">
              <div>
                <h3 style={{ margin: 0 }}>Sales Analytics (30 days)</h3>
                <span style={{ color: "#64748b", fontSize: 12 }}>
                  Revenue trend + top selling products
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!analyticsLoaded && (
                  <button className="btn secondary" type="button" onClick={loadAnalytics} disabled={loading}>
                    Load Analytics
                  </button>
                )}
                {analyticsLoaded && (
                  <button className="btn secondary" type="button" onClick={loadAnalytics} disabled={loading}>
                    Refresh Analytics
                  </button>
                )}
              </div>
            </div>

            {!analyticsLoaded && fastMode ? (
              <div style={{ color: "#64748b", fontSize: 12 }}>
                Analytics is paused to keep startup fast. Click “Load Analytics” when needed.
              </div>
            ) : (
              <>
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                  <div className="card">
                    <div className="label">Total Revenue</div>
                    <div className="value">{Math.round(analytics?.totalRevenue || 0)}</div>
                  </div>
                  <div className="card">
                    <div className="label">Total Bills</div>
                    <div className="value">{analytics?.totalBills || 0}</div>
                  </div>
                  <div className="card">
                    <div className="label">Avg Ticket</div>
                    <div className="value">{Math.round(analytics?.avgTicket || 0)}</div>
                  </div>
                  <div className="card">
                    <div className="label">Avg Items/Bill</div>
                    <div className="value">{Number(analytics?.avgItemsPerBill || 0).toFixed(1)}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginTop: 12 }}>
                  <div className="panel" style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Daily Revenue</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {(analytics?.daily || []).map((row) => (
                        <div key={row.date} style={{ display: "grid", gridTemplateColumns: "90px 1fr 70px", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#64748b" }}>{row.date}</span>
                          <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999 }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${analytics?.totalRevenue ? Math.round((row.total / analytics.totalRevenue) * 100) : 0}%`,
                                background: "#0f172a",
                                borderRadius: 999,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 12, textAlign: "right" }}>{Math.round(row.total)}</span>
                        </div>
                      ))}
                      {(!analytics || analytics.daily?.length === 0) && (
                        <div style={{ color: "#64748b", fontSize: 12 }}>No sales in the selected range.</div>
                      )}
                    </div>
                  </div>

                  <div className="panel" style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Top Products</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {(analytics?.topProducts || []).map((p) => (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 13 }}>{p.name}</span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>{p.qty} sold</span>
                        </div>
                      ))}
                      {(!analytics || analytics.topProducts?.length === 0) && (
                        <div style={{ color: "#64748b", fontSize: 12 }}>No products yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="panel">
            <h3>Add Product</h3>
            <form className="form" onSubmit={createProduct}>
              <div className="input-group">
                <label>Barcode</label>
                <input value={barcode} onChange={(e) => setBarcode(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Price</label>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Stock</label>
                <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
              </div>
              <button className="btn" type="submit" disabled={loading}>Save Product</button>
            </form>
          </div>

          <div className="panel">
            <h3>Create User</h3>
            <form className="form" onSubmit={createUser}>
              <div className="input-group">
                <label>Username</label>
                <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button className="btn" type="submit" disabled={loading}>Create User</button>
            </form>
          </div>

          <div className="panel panel-wide">
            <div className="table-tools">
              <div>
                <h3 style={{ margin: 0 }}>Products</h3>
                <span style={{ color: "#64748b", fontSize: 12 }}>Search, edit, and delete items</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input placeholder="Search by name or barcode" value={query} onChange={(e) => setQuery(e.target.value)} />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="name">Sort by name</option>
                  <option value="price">Sort by price</option>
                  <option value="stock">Sort by stock</option>
                </select>
                <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
                {!productsLoaded && (
                  <button className="btn secondary" type="button" onClick={() => loadProducts(0)} disabled={loading}>
                    Load Products
                  </button>
                )}
                {productsLoaded && (
                  <button className="btn secondary" type="button" onClick={() => loadProducts(page)} disabled={loading}>
                    Refresh
                  </button>
                )}
              </div>
            </div>

            {!productsLoaded && fastMode ? (
              <div style={{ color: "#64748b", fontSize: 12 }}>
                Products are paused to keep startup fast. Click “Load Products” when needed.
              </div>
            ) : (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>Barcode</th>
                      <th>Name</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((p) => {
                      const isEditing = editingBarcode === p.barcode;
                      return (
                        <tr key={p.barcode}>
                          <td>{p.barcode}</td>
                          <td>
                            {isEditing ? (
                              <input
                                value={editValues.name}
                                onChange={(e) => setEditValues((prev) => ({ ...prev, name: e.target.value }))}
                              />
                            ) : (
                              p.name
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="number"
                                value={editValues.price}
                                onChange={(e) => setEditValues((prev) => ({ ...prev, price: e.target.value }))}
                              />
                            ) : (
                              p.price
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="number"
                                value={editValues.stock}
                                onChange={(e) => setEditValues((prev) => ({ ...prev, stock: e.target.value }))}
                              />
                            ) : (
                              p.stock
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <button className="btn" type="button" onClick={() => saveEdit(p.barcode)}>
                                  Save
                                </button>
                                <button className="btn secondary" type="button" onClick={cancelEdit}>
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <button className="btn secondary" type="button" onClick={() => startEdit(p)}>
                                  Edit
                                </button>
                                <button className="btn ghost" type="button" onClick={() => deleteProduct(p.barcode)}>
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {visibleProducts.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center", padding: 16 }}>
                          No products match your filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 12 }}>
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={loading || page === 0}
                    onClick={() => loadProducts(page - 1)}
                  >
                    Prev
                  </button>
                  <span>
                    Page {page + 1} of {Math.max(1, Math.ceil(productsTotal / pageSize))}
                  </span>
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={loading || (page + 1) * pageSize >= productsTotal}
                    onClick={() => loadProducts(page + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="panel panel-wide">
            <div className="table-tools">
              <div>
                <h3 style={{ margin: 0 }}>Users</h3>
                <span style={{ color: "#64748b", fontSize: 12 }}>Manage access roles</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!usersLoaded && (
                  <button className="btn secondary" type="button" onClick={loadUsers} disabled={loading}>
                    Load Users
                  </button>
                )}
                {usersLoaded && (
                  <button className="btn secondary" type="button" onClick={loadUsers} disabled={loading}>
                    Refresh Users
                  </button>
                )}
              </div>
            </div>

            {!usersLoaded && fastMode ? (
              <div style={{ color: "#64748b", fontSize: 12 }}>
                Users are paused to keep startup fast. Click “Load Users” when needed.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>
                        <select
                          value={roleEdits[u.id] ?? u.role}
                          onChange={(e) => setRoleEdits((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        >
                          <option value="admin">Admin</option>
                          <option value="cashier">Cashier</option>
                        </select>
                      </td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button className="btn secondary" type="button" onClick={() => updateRole(u.id)}>
                            Update Role
                          </button>
                          <button className="btn ghost" type="button" onClick={() => deleteUser(u.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center", padding: 16 }}>
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
