import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api";
import { useNavigate } from "react-router-dom";
import ReceiptPrint from "./ReceiptPrint";

export default function Cashier({ onLogout }) {
  // Discount + Payment
  const [discountType, setDiscountType] = useState("none"); // none | amount | percent
  const [discountValue, setDiscountValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash"); // cash | card
  const [cashReceived, setCashReceived] = useState("");
  const [showPrint, setShowPrint] = useState(false);


  const navigate = useNavigate();

  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState(1);

  const [cart, setCart] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Sales History

  const subtotal = useMemo(
    () =>
      cart.reduce((sum, i) => {
        const price = Number(String(i.price).replace(/,/g, "")); // safe convert
        const q = Number(i.qty);
        return sum + (Number.isFinite(price) ? price : 0) * (Number.isFinite(q) ? q : 0);
      }, 0),
    [cart]
  );

  const discountAmount = useMemo(() => {
    const v = Number(discountValue || 0);

    if (discountType === "amount") {
      return Math.max(0, Math.min(v, subtotal));
    }

    if (discountType === "percent") {
      const pct = Math.max(0, Math.min(v, 100));
      return Math.round((subtotal * pct) / 100);
    }

    return 0;
  }, [discountType, discountValue, subtotal]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const balance = useMemo(() => {
    if (paymentMethod !== "cash") return 0;

    const received = parseFloat(String(cashReceived ?? "").replace(/,/g, "").trim());
    const safeReceived = Number.isFinite(received) ? received : 0;

    return safeReceived - grandTotal;
  }, [paymentMethod, cashReceived, grandTotal]);

  const addByBarcode = async () => {
    setMsg("");
    const code = barcode.trim();
    if (!code) return;

    try {
      setLoading(true);
      const product = await apiFetch(`/products/${code}`);

      setCart((prev) => {
        const existing = prev.find((p) => p.barcode === product.barcode);
        if (existing) {
          return prev.map((p) =>
            p.barcode === product.barcode ? { ...p, qty: p.qty + Number(qty) } : p
          );
        }
        return [
          ...prev,
          {
            ...product,
            price: Number(String(product.price).replace(/,/g, "")), // safe numeric
            qty: Number(qty),
          },
        ];
      });

      setBarcode("");
      setQty(1);
    } catch (e) {
      setMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = (code) => setCart((prev) => prev.filter((p) => p.barcode !== code));

  const changeQty = (code, newQty) => {
    const q = Number(newQty);
    if (!q || q < 1) return;
    setCart((prev) => prev.map((p) => (p.barcode === code ? { ...p, qty: q } : p)));
  };

  // ✅ FIXED: Clear really clears the cart + inputs (keeps your existing resets too)
  const clearCart = () => {
    setCart([]);            // ✅ THIS was missing (main bug)
    setMsg("");
    setBarcode("");
    setQty(1);

    setDiscountType("none");
    setDiscountValue("");
    setPaymentMethod("cash");
    setCashReceived("");
  };

  const completeSale = async () => {
    // ✅ FIXED: check cart first
    if (cart.length === 0) {
      setMsg("❌ Cart is empty");
      return;
    }

    // ✅ Validate cash only if cash method
    if (paymentMethod === "cash") {
      const received = parseFloat(String(cashReceived ?? "").replace(/,/g, "").trim());
      const total = Number(grandTotal);

      if (!Number.isFinite(received)) {
        setMsg("❌ Please enter cash received");
        return;
      }

      if (received + 1e-9 < total) {
        setMsg("❌ Cash received is not enough");
        return;
      }
    }

    try {
      setLoading(true);
      setMsg("");

      await apiFetch("/sales", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((i) => ({ barcode: i.barcode, qty: i.qty })),
        }),
      });

      setMsg("✅ Sale completed!");
      clearCart();

      // auto refresh history after sale
      await loadSales();
    } catch (e) {
      setMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSales = async () => {
    setMsg("");
    try {
      setLoading(true);
      await apiFetch("/sales");
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
        <h2 style={{ margin: 0 }}>🧾 Cashier</h2>
        <button onClick={onLogout} style={{ padding: 10, fontSize: 16 }}>
          Logout
        </button>
      </div>

      <button onClick={() => navigate("/history")} style={{ padding: 10, fontSize: 16 }}>
        Sales History
      </button>
      <button onClick={() => navigate("/reports")} style={{ padding: 10, fontSize: 16 }}>
        Reports
      </button>
      <button onClick={() => navigate("/end-day")} style={{ padding: 10, fontSize: 16 }}>
        End Day
      </button>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      {/* Barcode add */}
      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <input
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Scan / Enter Barcode"
          style={{ padding: 10, width: 260 }}
          onKeyDown={(e) => e.key === "Enter" && addByBarcode()}
        />
        <input
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={{ padding: 10, width: 90 }}
        />
        <button onClick={addByBarcode} disabled={loading} style={{ padding: 10, fontSize: 16 }}>
          Add
        </button>
        <button onClick={clearCart} disabled={loading} style={{ padding: 10 }}>
          Clear
        </button>
      </div>

      {/* ✅ Discount + Payment */}
      <div style={{ marginTop: 18, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>💰 Discount & Payment</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
          <div>
            <label>Discount Type</label>
            <select
              value={discountType}
              onChange={(e) => {
                setDiscountType(e.target.value);
                setDiscountValue("");
              }}
              style={{ width: "100%", padding: 10, marginTop: 5 }}
            >
              <option value="none">None</option>
              <option value="amount">Rs (Amount)</option>
              <option value="percent">Percent (%)</option>
            </select>
          </div>

          <div>
            <label>Discount Value</label>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              disabled={discountType === "none"}
              placeholder={discountType === "percent" ? "ex: 10" : "ex: 50"}
              style={{ width: "100%", padding: 10, marginTop: 5 }}
            />
          </div>

          <div>
            <label>Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                setCashReceived("");
              }}
              style={{ width: "100%", padding: 10, marginTop: 5 }}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
            </select>
          </div>

          <div>
            <label>Cash Received</label>
            <input
              type="number"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              disabled={paymentMethod !== "cash"}
              placeholder="ex: 5000"
              style={{ width: "100%", padding: 10, marginTop: 5 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 12, lineHeight: 1.8 }}>
          <div>Subtotal: <b>{subtotal}</b></div>
          <div>Discount: <b>{discountAmount}</b></div>
          <div>Grand Total: <b>{grandTotal}</b></div>

          {paymentMethod === "cash" && (
            <div>
              Balance/Change:{" "}
              <b style={{ color: balance < 0 ? "crimson" : "green" }}>
                {balance}
              </b>
              {balance < 0 && <span style={{ marginLeft: 8 }}>(Not enough cash)</span>}
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div style={{ marginTop: 15 }}>
        <h3>🛒 Cart</h3>

        <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Barcode</th>
              <th>Item</th>
              <th style={{ width: 120 }}>Qty</th>
              <th style={{ width: 120 }}>Price</th>
              <th style={{ width: 140 }}>Line Total</th>
              <th style={{ width: 100 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((i) => (
              <tr key={i.barcode}>
                <td>{i.barcode}</td>
                <td>{i.name}</td>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={i.qty}
                    onChange={(e) => changeQty(i.barcode, e.target.value)}
                    style={{ width: 80, padding: 6 }}
                  />
                </td>
                <td>{i.price}</td>
                <td>{Number(i.price) * Number(i.qty)}</td>
                <td>
                  <button onClick={() => removeItem(i.barcode)}>Remove</button>
                </td>
              </tr>
            ))}

            {cart.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: "center" }}>
                  Cart is empty
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <h3 style={{ marginTop: 15 }}>Subtotal: {subtotal}</h3>

        <button
          onClick={completeSale}
          disabled={loading || cart.length === 0}
          style={{ padding: 12, fontSize: 16 }}
        >
          Complete Sale
        </button>
      </div>
      <button
  onClick={() => setShowPrint(true)}
  style={{ padding: 12, fontSize: 16, marginLeft: 10 }}
>
  Trial Print
</button>
{showPrint && (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20
  }}>
    <div style={{ background: "#fff", padding: 15, borderRadius: 10, maxWidth: 420, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>🖨️ Print Preview</h3>
        <button onClick={() => setShowPrint(false)}>X</button>
      </div>

      <div id="print-area" style={{ marginTop: 10 }}>
        <ReceiptPrint
          companyName="RITIGALA GROCERY"   // ✅ change this to your company name
          saleId="TRIAL-001"
          items={
            cart.length
              ? cart
              : [{ barcode: "trial", name: "Trial Item", qty: 1, price: 150 }]
          }
          subtotal={subtotal || 150}
          discount={discountAmount || 0}
          grandTotal={grandTotal || 150}
          paymentMethod={paymentMethod}
          cashReceived={cashReceived || 150}
          balance={balance || 0}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button
          onClick={() => window.print()}
          style={{ padding: 12, fontSize: 16 }}
        >
          Print Now
        </button>
        <button
          onClick={() => setShowPrint(false)}
          style={{ padding: 12 }}
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}


    </div>
    
  );
}
