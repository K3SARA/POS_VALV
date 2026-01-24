import React, { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { useNavigate } from "react-router-dom";

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [openSaleId, setOpenSaleId] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const loadSales = async () => {
    setMsg("");
    try {
      setLoading(true);
      const data = await apiFetch("/sales");
      setSales(data);
    } catch (e) {
      setMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  return (
    <div style={{ fontFamily: "Arial", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>📜 Sales History</h2>
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

      {sales.length === 0 ? (
        <p style={{ marginTop: 10, color: "#666" }}>No sales found.</p>
      ) : (
        <div style={{ marginTop: 10 }}>
          {sales.map((s) => (
            <div key={s.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <b>Sale #{s.id}</b>{" "}
                  {s.createdAt && (
                    <span style={{ color: "#666", fontSize: 12 }}>
                      ({new Date(s.createdAt).toLocaleString()})
                    </span>
                  )}
                  <div>Total: <b>{s.total}</b></div>
                </div>

                <button onClick={() => setOpenSaleId(openSaleId === s.id ? null : s.id)}>
                  {openSaleId === s.id ? "Hide" : "View"}
                </button>
              </div>

              {openSaleId === s.id && (
                <div style={{ marginTop: 10 }}>
                  <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(s.saleItems || []).map((si) => (
                        <tr key={si.id}>
                          <td>{si.product?.name || "Unknown"}</td>
                          <td>{si.qty}</td>
                          <td>{si.price}</td>
                          <td>{si.price * si.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
