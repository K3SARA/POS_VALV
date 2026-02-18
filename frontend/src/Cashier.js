import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./api";
import { useNavigate } from "react-router-dom";
import ReceiptPrint from "./ReceiptPrint";
import { applyReceiptPrint, cleanupReceiptPrint } from "./printUtils";

export default function Cashier({ onLogout }) {
  const role = localStorage.getItem("role");
  const requiresStartDay = role === "cashier";

  const navigate = useNavigate();

  // Discount + Payment
  const [discountType, setDiscountType] = useState("none"); // none | amount | percent
  const [discountValue, setDiscountValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash"); // cash | card | credit | check
  const [cashReceived, setCashReceived] = useState("");
  const [showPrint, setShowPrint] = useState(false);
  const [printPayload, setPrintPayload] = useState(null);
  const [showLayoutEditor, setShowLayoutEditor] = useState(false);
  const [printPaperPrompt, setPrintPaperPrompt] = useState(false);
  const [printLayoutMode, setPrintLayoutMode] = useState("3inch");
  const [showReportsMenu, setShowReportsMenu] = useState(false);
  const [showStockMenu, setShowStockMenu] = useState(false);
  const reportsMenuRef = useRef(null);
  const stockMenuRef = useRef(null);
  const DEFAULT_BILL_LAYOUT = {
    companyName: "Apex Logistics",
    headerText: "Aluviharaya, Matale\nMobile: +94770654279\nThank you! Visit again",
    footerText: "Powered by POS",
    showItemsHeading: true,
    showCustomer: true,
    showTotals: true,
    showPayment: true,
  };
  const [billLayout, setBillLayout] = useState(() => {
    try {
      const raw = localStorage.getItem("billLayout");
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_BILL_LAYOUT, ...parsed };
      }
    } catch {
      // ignore bad layout data
    }
    return DEFAULT_BILL_LAYOUT;
  });
  const [layoutDraft, setLayoutDraft] = useState(billLayout);
  
  // Drafts
  const [drafts, setDrafts] = useState([]);
  const [draftName, setDraftName] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [showDraftDropdown, setShowDraftDropdown] = useState(false);
  const [cart, setCart] = useState([]);
  const [dayStarted, setDayStarted] = useState(!requiresStartDay);
  const [dayStatusLoading, setDayStatusLoading] = useState(requiresStartDay);
  const [dayRoute, setDayRoute] = useState("");
  const [routes, setRoutes] = useState([]);
  const [routeInput, setRouteInput] = useState("");


  // Customer (required)
  const customerEnabled = true;
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // Customer dropdown search
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [allCustomers, setAllCustomers] = useState([]);

  const loadAllCustomers = async () => {
    try {
      setCustomerLoading(true);
      const data = await apiFetch("/customers");
      const list = Array.isArray(data) ? data : [];
      setAllCustomers(list);
      setCustomerResults(list);
    } catch (e) {
      setAllCustomers([]);
      setCustomerResults([]);
    } finally {
      setCustomerLoading(false);
    }
  };

  const filterCustomers = (text) => {
    const q = String(text || "").trim().toLowerCase();
    if (!q) {
      setCustomerResults(allCustomers);
      return;
    }
    const filtered = allCustomers.filter((c) => {
      const name = String(c.name || "").toLowerCase();
      const phone = String(c.phone || "").toLowerCase();
      const address = String(c.address || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || address.includes(q);
    });
    setCustomerResults(filtered);
  };

  const chooseCustomer = (c) => {
    setCustomerName(c.name || "");
    setCustomerPhone(c.phone || "");
    setCustomerAddress(c.address || "");
    setShowCustomerDropdown(false);
  };

  const fetchDrafts = async () => {
    try {
      setDraftLoading(true);
      const list = await apiFetch("/drafts");
      setDrafts(Array.isArray(list) ? list : []);
    } catch {
      setDrafts([]);
      setMsg("Failed to load drafts. Please login again or check server.");
    } finally {
      setDraftLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
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

  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState(1);

  // Item dropdown search
  const [itemResults, setItemResults] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [itemLoading, setItemLoading] = useState(false);
  const [allItems, setAllItems] = useState([]);

  const loadAllItems = async () => {
    try {
      setItemLoading(true);
      const data = await apiFetch("/products");
      const list = Array.isArray(data) ? data : (data?.items || []);
      const inStockList = list.filter((p) => Number(p?.stock || 0) > 0);
      setAllItems(list);
      setItemResults(inStockList);
      setShowItemDropdown(true);
    } catch (e) {
      setAllItems([]);
      setItemResults([]);
      setShowItemDropdown(false);
    } finally {
      setItemLoading(false);
    }
  };

  const filterItems = (text) => {
    const q = String(text || "").trim().toLowerCase();
    if (!q) {
      setItemResults(allItems.filter((p) => getRemainingStockForDisplay(p.barcode) > 0));
      setShowItemDropdown(true);
      return;
    }
    const filtered = allItems.filter((p) => {
      const name = String(p.name || "").toLowerCase();
      const barcodeText = String(p.barcode || "").toLowerCase();
      return (name.includes(q) || barcodeText.includes(q)) && getRemainingStockForDisplay(p.barcode) > 0;
    });
    setItemResults(filtered);
    setShowItemDropdown(true);
  };

  const chooseItem = (p) => {
    setBarcode(p.barcode || "");
    setShowItemDropdown(false);
  };

  const getFreeQtyByBarcode = (code) =>
    cart.reduce(
      (sum, i) =>
        i.barcode === code
          ? sum + Number(i.freeIssue ? i.qty || 0 : i.freeQty || 0)
          : sum,
      0
    );

  const getPaidQtyByBarcode = (code) =>
    cart.reduce((sum, i) => (i.barcode === code && !i.freeIssue ? sum + Number(i.qty || 0) : sum), 0);

  const getStockForBarcode = (code) => {
    const item = allItems.find((p) => p.barcode === code) || cart.find((p) => p.barcode === code);
    const stock = Number(item?.stock ?? 0);
    return Number.isFinite(stock) ? stock : 0;
  };

  const getRemainingStockForDisplay = (code) => {
    const stock = getStockForBarcode(code);
    const paid = getPaidQtyByBarcode(code);
    const free = getFreeQtyByBarcode(code);
    return Math.max(0, stock - paid - free);
  };

  const getAvailableForEdit = (code, isFreeIssue, currentQty) => {
    const stock = getStockForBarcode(code);
    const otherQty = getPaidQtyByBarcode(code) - Number(currentQty || 0);
    return Math.max(0, stock - otherQty);
  };

  const setFreeQtyForBarcode = (code, qty) => {
    const q = Number(qty);
    if (!Number.isFinite(q) || q < 0) return;

    const stock = getStockForBarcode(code);
    const paidQty = getPaidQtyByBarcode(code);
    const available = Math.max(0, stock - paidQty);
    if (q > available) {
      setMsg(`Only ${available} available for free issue`);
      return;
    }

    setCart((prev) => {
      const baseItem = prev.find((p) => p.barcode === code && !p.freeIssue);
      if (!baseItem) {
        setMsg("Add paid qty first");
        return prev;
      }

      return prev
        .filter((p) => !(p.barcode === code && p.freeIssue))
        .map((p) =>
          p.barcode === code && !p.freeIssue ? { ...p, freeQty: q } : p
        );
    });
  };

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!requiresStartDay) {
      setDayStarted(true);
      setDayStatusLoading(false);
      return;
    }

    let cancelled = false;

    const loadDayStatus = async () => {
      setDayStatusLoading(true);
      try {
        const [status, routeRows] = await Promise.all([
          apiFetch("/cashier/day/status"),
          apiFetch("/routes"),
        ]);
        if (cancelled) return;
        const started = Boolean(status?.started);
        const activeRoutes = Array.isArray(routeRows)
          ? routeRows.filter((r) => Boolean(r?.isActive))
          : [];
        const currentRoute = String(status?.session?.route || "");

        setDayStarted(started);
        setDayRoute(currentRoute);
        setRoutes(activeRoutes);
        setRouteInput(currentRoute);
      } catch (e) {
        if (cancelled) return;
        setDayStarted(false);
        setDayRoute("");
        setRoutes([]);
        setRouteInput("");
        setMsg("Error: " + e.message);
      } finally {
        if (!cancelled) setDayStatusLoading(false);
      }
    };

    loadDayStatus();
    return () => {
      cancelled = true;
    };
  }, [requiresStartDay]);

  const getLineBase = useCallback((i) => {
    const price = Number(String(i.price).replace(/,/g, ""));
    const q = Number(i.qty);
    const safePrice = Number.isFinite(price) ? price : 0;
    const safeQty = Number.isFinite(q) ? q : 0;
    return safePrice * safeQty;
  }, []);

  const getItemDiscountAmount = useCallback((i) => {
    const base = getLineBase(i);
    const t = i.itemDiscountType || "none";
    const v = Number(i.itemDiscountValue || 0);

    if (t === "amount") {
      return Math.max(0, Math.min(v, base));
    }

    if (t === "percent") {
      const pct = Math.max(0, Math.min(v, 100));
      return Math.round((base * pct) / 100);
    }

    return 0;
  }, [getLineBase]);

  const subtotal = useMemo(
    () =>
      cart.reduce((sum, i) => {
        const base = getLineBase(i);
        const itemDisc = getItemDiscountAmount(i);
        return sum + Math.max(0, base - itemDisc);
      }, 0),
    [cart, getItemDiscountAmount, getLineBase]
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

  const buildLines = (text) =>
    String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const layoutForPrint = useMemo(
    () => ({
      ...layoutDraft,
      headerLines: buildLines(layoutDraft.headerText),
      footerLines: buildLines(layoutDraft.footerText),
    }),
    [layoutDraft]
  );

  const openPrintPreview = (payload) => {
    setPrintPayload(payload);
    setLayoutDraft(billLayout);
    setShowLayoutEditor(false);
    setShowPrint(true);
  };

  const saveLayout = () => {
    setBillLayout(layoutDraft);
    try {
      localStorage.setItem("billLayout", JSON.stringify(layoutDraft));
    } catch {
      // ignore storage errors
    }
    setMsg("Bill layout saved");
  };

  const resetLayout = () => {
    setLayoutDraft(DEFAULT_BILL_LAYOUT);
  };

  const handlePrintNow = () => {
    setPrintPaperPrompt(true);
  };

  const confirmPrint = (mode) => {
    setPrintLayoutMode(mode);
    setPrintPaperPrompt(false);
    applyReceiptPrint(mode);
    const cleanup = () => {
      cleanupReceiptPrint();
      window.onafterprint = null;
      window.removeEventListener("focus", cleanup);
    };
    window.onafterprint = cleanup;
    window.addEventListener("focus", cleanup, { once: true });
    setTimeout(() => {
      window.print();
      setMsg("Bill printed");
    }, 100);
  };

  const addByBarcode = async () => {
    setMsg("");
    const code = barcode.trim();
    if (!code) return;

    try {
      setLoading(true);
      const product = await apiFetch(`/products/${code}`);
      const currentStock = Number(product?.stock || 0);
      if (!Number.isFinite(currentStock) || currentStock <= 0) {
        setMsg("Item is out of stock");
        return;
      }

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
            price: Number(String(product.price).replace(/,/g, "")),
            qty: Number(qty),
            freeQty: 0,
            itemDiscountType: "none",
            itemDiscountValue: "",
          },
        ];
      });

      setBarcode("");
      setQty(1);
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = (code, isFreeIssue) =>
    setCart((prev) =>
      prev.filter((p) => !(p.barcode === code && Boolean(p.freeIssue) === Boolean(isFreeIssue)))
    );

  const changeQty = (code, newQty, isFreeIssue) => {
    const q = Number(newQty);
    if (!q || q < 1) return;
    const currentQty = cart.find((p) => p.barcode === code && Boolean(p.freeIssue) === Boolean(isFreeIssue))?.qty || 0;
    const available = getAvailableForEdit(code, isFreeIssue, currentQty);
    if (q > available) {
      setMsg(`Only ${available} available for this item`);
      return;
    }
    setCart((prev) =>
      prev.map((p) =>
        p.barcode === code && Boolean(p.freeIssue) === Boolean(isFreeIssue)
          ? { ...p, qty: q }
          : p
      )
    );
  };

  const changeItemDiscountType = (code, type, isFreeIssue) => {
    setCart((prev) =>
      prev.map((p) =>
        p.barcode === code && Boolean(p.freeIssue) === Boolean(isFreeIssue)
          ? { ...p, itemDiscountType: type, itemDiscountValue: "" }
          : p
      )
    );
  };

  const changeItemDiscountValue = (code, value, isFreeIssue) => {
    setCart((prev) =>
      prev.map((p) =>
        p.barcode === code && Boolean(p.freeIssue) === Boolean(isFreeIssue)
          ? { ...p, itemDiscountValue: value }
          : p
      )
    );
  };


  const clearCart = () => {
    setCart([]);
    setMsg("");
    setBarcode("");
    setQty(1);

    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");

    setDiscountType("none");
    setDiscountValue("");
    setPaymentMethod("cash");
    setCashReceived("");

    setShowCustomerDropdown(false);
    setCustomerResults([]);
  };

  const saveDraft = async () => {
    try {
      setLoading(true);
      const payload = {
        name: draftName.trim() || null,
        cart,
        customerEnabled,
        customerName,
        customerPhone,
        customerAddress,
        discountType,
        discountValue,
        paymentMethod,
        cashReceived,
      };

      await apiFetch("/drafts", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setMsg("Draft saved");
      setDraftName("");

      const list = await apiFetch("/drafts");
      setDrafts(Array.isArray(list) ? list : []);
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDraft = async (id) => {
    try {
      setLoading(true);
      const draft = await apiFetch(`/drafts/${id}`);
      const d = draft?.data || {};

      setCart(Array.isArray(d.cart) ? d.cart : []);
      setCustomerName(d.customerName || "");
      setCustomerPhone(d.customerPhone || "");
      setCustomerAddress(d.customerAddress || "");
      setDiscountType(d.discountType || "none");
      setDiscountValue(d.discountValue ?? "");
      setPaymentMethod(d.paymentMethod || "cash");
      setCashReceived(d.cashReceived ?? "");

      setMsg("Draft loaded");
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteDraft = async (id) => {
    try {
      setLoading(true);
      await apiFetch(`/drafts/${id}`, { method: "DELETE" });
      const list = await apiFetch("/drafts");
      setDrafts(Array.isArray(list) ? list : []);
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const nameRegex = /^[A-Za-z\s]+$/;
  const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

  const startDay = async () => {
    const route = String(routeInput || "").trim();
    if (!route) {
      setMsg("Route is required");
      return;
    }

    try {
      setLoading(true);
      setMsg("");
      const data = await apiFetch("/cashier/day/start", {
        method: "POST",
        body: JSON.stringify({ route }),
      });
      const startedRoute = String(data?.session?.route || route);
      setDayStarted(true);
      setDayRoute(startedRoute);
      setRouteInput(startedRoute);
      setMsg(`Day started (${startedRoute})`);
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const endDay = async () => {
    try {
      setLoading(true);
      setMsg("");
      await apiFetch("/cashier/day/end", { method: "POST" });
      setDayStarted(false);
      setDayRoute("");
      setRouteInput("");
      setMsg("Day ended");
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const completeSale = async () => {
    if (requiresStartDay && !dayStarted) {
      setMsg("Start day is required before billing");
      return;
    }

    if (cart.length === 0) {
      setMsg("Cart is empty");
      return;
    }

    if (paymentMethod === "cash") {
      const received = parseFloat(String(cashReceived ?? "").replace(/,/g, "").trim());
      const total = Number(grandTotal);

      if (!Number.isFinite(received)) {
        setMsg("Please enter cash received");
        return;
      }

      if (received + 1e-9 < total) {
        setMsg("Cash received is not enough");
        return;
      }
    }

      const payload = {
        items: cart.map((i) => ({
          barcode: i.barcode,
          qty: i.qty,
          freeQty: Number(i.freeQty || 0),
          itemDiscountType: i.itemDiscountType || "none",
          itemDiscountValue: Number(i.itemDiscountValue || 0),
        })),
        paymentMethod,
        discountType,
        discountValue,
      };


    const name = customerName.trim();
    if (!name) {
      setMsg("Customer name is required");
      return;
    }
    if (!nameRegex.test(name)) {
      setMsg("Customer name must contain only letters and spaces");
      return;
    }
    const phoneDigits = digitsOnly(customerPhone);
    if (phoneDigits && phoneDigits.length !== 10) {
      setMsg("Customer phone must be exactly 10 digits");
      return;
    }

    payload.customer = {
      name,
      phone: phoneDigits || null,
      address: customerAddress.trim() || null,
    };

    try {
      setLoading(true);
      setMsg("");

      const cartSnapshot = cart.map((i) => ({ ...i }));
      const subtotalSnapshot = subtotal;
      const discountSnapshot = discountAmount;
      const grandTotalSnapshot = grandTotal;
      const balanceSnapshot = balance;
      const sale = await apiFetch("/sales", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setMsg("Sale completed!");
      const saleId =
        sale?.id || sale?.saleId || sale?._id || sale?.invoiceNo || sale?.billNo || "";
      openPrintPreview({
        saleId,
        dateText: new Date().toLocaleString(),
        items: cartSnapshot,
        subtotal: subtotalSnapshot,
        discount: discountSnapshot,
        grandTotal: grandTotalSnapshot,
        paymentMethod,
        cashReceived,
        balance: balanceSnapshot,
        customerName,
        customerPhone,
        customerAddress,
      });
      clearCart();
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Cashier</h2>
        {role === "admin" && (
  <button
    className="btn ghost"
    onClick={() => navigate("/admin")}
  >
    Go Back
  </button>
)}

<button className="btn" onClick={onLogout} style={{ background: "#dc2626", color: "#fff", border: "1px solid #b91c1c" }}>Logout</button>

      </div>

      <button onClick={() => navigate("/admin")} style={{ padding: 10, fontSize: 16 }}>
        {"\uD83C\uDFE0"} Home
      </button>
      <button onClick={() => navigate("/reports")} style={{ padding: 10, fontSize: 16 }}>
        Sales History
      </button>
      <div ref={reportsMenuRef} style={{ position: "relative", display: "inline-block" }}>
        <button onClick={() => setShowReportsMenu((v) => !v)} style={{ padding: 10, fontSize: 16 }}>
          Reports
        </button>
        {showReportsMenu && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, display: "grid", gap: 6, padding: 8, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 50, minWidth: 170 }}>
            <button onClick={() => { setShowReportsMenu(false); navigate("/reports"); }} style={{ padding: 8, fontSize: 14 }}>
              Sales Reports
            </button>
            <button onClick={() => { setShowReportsMenu(false); navigate("/reports/items"); }} style={{ padding: 8, fontSize: 14 }}>
              Item-wise Report
            </button>
          </div>
        )}
      </div>
      <button onClick={() => navigate("/end-day")} style={{ padding: 10, fontSize: 16 }}>
        End Day
      </button>
      <button onClick={() => navigate("/returns")} style={{ padding: 10, fontSize: 16 }}>
        Returns
      </button>
      {role !== "admin" && (
        <div ref={stockMenuRef} style={{ position: "relative", display: "inline-block" }}>
          <button onClick={() => setShowStockMenu((v) => !v)} style={{ padding: 10, fontSize: 16 }}>
            Stock
          </button>
          {showStockMenu && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, display: "grid", gap: 6, padding: 8, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 50, minWidth: 170 }}>
              <button onClick={() => { setShowStockMenu(false); navigate("/stock"); }} style={{ padding: 8, fontSize: 14 }}>
                Current Stock
              </button>
              <button onClick={() => { setShowStockMenu(false); navigate("/stock/returned"); }} style={{ padding: 8, fontSize: 14 }}>
                Returned Stock
              </button>
            </div>
          )}
        </div>
      )}
      {role === "admin" && (
        <>
          <div ref={stockMenuRef} style={{ position: "relative", display: "inline-block" }}>
            <button onClick={() => setShowStockMenu((v) => !v)} style={{ padding: 10, fontSize: 16 }}>
              Stock
            </button>
            {showStockMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, display: "grid", gap: 6, padding: 8, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 50, minWidth: 170 }}>
                <button onClick={() => { setShowStockMenu(false); navigate("/stock"); }} style={{ padding: 8, fontSize: 14 }}>
                  Current Stock
                </button>
                <button onClick={() => { setShowStockMenu(false); navigate("/stock/returned"); }} style={{ padding: 8, fontSize: 14 }}>
                  Returned Stock
                </button>
              </div>
            )}
          </div>
          <button onClick={() => navigate("/customers")} style={{ padding: 10, fontSize: 16 }}>
            Customers
          </button>
        </>
      )}

      {requiresStartDay && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 10,
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <b>
            {dayStatusLoading
              ? "Checking day status..."
              : dayStarted
                ? `Day Started - Route: ${dayRoute || "-"}`
                : "Day Not Started"}
          </b>
          {!dayStarted && (
            <select
              value={routeInput}
              onChange={(e) => setRouteInput(e.target.value)}
              disabled={loading || dayStatusLoading}
              style={{ padding: 8, minWidth: 200 }}
            >
              <option value="">Select route</option>
              {routes.map((r) => (
                <option key={r.id || r.name} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
          {!dayStarted ? (
            <button onClick={startDay} disabled={loading || dayStatusLoading || !routeInput} style={{ padding: 8 }}>
              Start Day
            </button>
          ) : (
            <button onClick={endDay} disabled={loading || dayStatusLoading} style={{ padding: 8 }}>
              End Day
            </button>
          )}
        </div>
      )}

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      {/* Customer + Barcode add */}
      <div style={{ marginTop: 10 }}>
        <h3 style={{ margin: "0 0 8px" }}>Customer Details</h3>

        <div style={{ position: "relative", marginBottom: 8 }}>
          <button
            onClick={() => {
              setShowDraftDropdown((v) => !v);
              fetchDrafts();
            }}
            style={{ padding: 8 }}
          >
            Load Drafts
          </button>
          {showDraftDropdown && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                background: "#fff",
                color: "#000",
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: 8,
                minWidth: 260,
                maxHeight: 240,
                overflowY: "auto",
                zIndex: 9999,
              }}
            >
              {draftLoading && <div style={{ fontSize: 12, color: "#000" }}>Loading drafts...</div>}
              {!draftLoading && drafts.length === 0 && (
                <div style={{ fontSize: 12, color: "#000" }}>No drafts saved</div>
              )}
              {!draftLoading &&
                drafts.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginTop: 6,
                      padding: "6px 0",
                      borderTop: "1px solid #eee",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <b>{d.name || `Draft #${d.id}`}</b>
                      <div style={{ fontSize: 11, color: "#444" }}>
                        {new Date(d.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        loadDraft(d.id);
                        setShowDraftDropdown(false);
                      }}
                      disabled={loading}
                    >
                      Load
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Customer Name + Dropdown */}
          <div style={{ position: "relative", width: 200 }}>
            <input
              id="customerNameSearch"  // Add this
              name="customerNameSearch" // Add this
              value={customerName}
              onChange={(e) => {
                const v = e.target.value.replace(/[^A-Za-z\s]/g, "");
                setCustomerName(v);
                setShowCustomerDropdown(true);
                filterCustomers(v);
              }}
              onFocus={() => {
                setShowCustomerDropdown(true);
                if (allCustomers.length === 0) {
                  loadAllCustomers();
                } else {
                  filterCustomers(customerName);
                }
              }}
              onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
              placeholder="Customer Name"
              style={{ padding: 10, width: "100%" }}
            />

            {showCustomerDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "#fff",
                  color: "#000",
                  border: "1px solid #ccc",
                  borderTop: "none",
                  maxHeight: 200,
                  overflowY: "auto",
                  zIndex: 9999,
                }}
              >
                {customerLoading && (
                    <div style={{ padding: 8, fontSize: 13, color: "#000" }}>Searching...</div>
                )}

                {!customerLoading && customerResults.length === 0 && customerName.trim() && (
                  <div style={{ padding: 8, fontSize: 13, color: "#000" }}>No customers found</div>
                )}

                {!customerLoading &&
                  customerResults.map((c) => (
                    <div
                      key={c.id}
                      onMouseDown={() => chooseCustomer(c)}
                      style={{
                        padding: 10,
                        cursor: "pointer",
                        borderTop: "1px solid #eee",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "#000" }}>
                    {c.phone ? `Phone: ${c.phone}` : "No phone"}
                    {c.address ? ` | ${c.address}` : ""}
                  </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Barcode input */}
          <div style={{ position: "relative" }}>
              <input
                value={barcode}
                onChange={(e) => {
                  const v = e.target.value;
                  setBarcode(v);
                  if (allItems.length === 0) {
                    loadAllItems();
                  } else {
                    filterItems(v);
                  }
                }}
                placeholder="Scan / Enter Barcode"
                style={{ padding: 10, width: 260 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setShowItemDropdown(false);
                    addByBarcode();
                  }
                }}
                onFocus={() => {
                  if (allItems.length === 0) {
                    loadAllItems();
                  } else {
                    filterItems(barcode);
                  }
                }}
              onBlur={() => {
                setTimeout(() => setShowItemDropdown(false), 120);
              }}
            />

            {showItemDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: 44,
                    left: 0,
                    width: 320,
                    background: "#fff",
                    color: "#000",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                    zIndex: 20,
                    maxHeight: 280,
                    overflowY: "auto",
                  }}
                >
                {itemLoading ? (
                  <div style={{ padding: 10, color: "#000" }}>Searching...</div>
                ) : (itemResults || []).length === 0 ? (
                  <div style={{ padding: 10, color: "#000" }}>No items found</div>
                ) : (
                  itemResults.map((p) => (
                    <div
                      key={p.barcode}
                      onMouseDown={() => chooseItem(p)}
                      style={{
                        padding: 10,
                        cursor: "pointer",
                        borderTop: "1px solid #eee",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: "#000" }}>
                        {p.barcode} | Price: {p.price} | Stock: {getRemainingStockForDisplay(p.barcode)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Qty */}
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

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: 8,
          }}
        >
          <input
            value={customerPhone}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            onChange={(e) => {
              const digits = digitsOnly(e.target.value).slice(0, 10);
              setCustomerPhone(digits);
            }}
            placeholder="Customer Phone"
            style={{ padding: 10, width: 180 }}
          />
          {customerPhone && digitsOnly(customerPhone).length !== 10 && (
            <span style={{ color: "#ff6b6b", fontSize: 12 }}>
              Phone must be 10 digits
            </span>
          )}
          <input
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            placeholder="Customer Address"
            style={{ padding: 10, width: 360, flex: "1 1 240px" }}
          />
        </div>
      </div>

      {/* Discount + Payment */}
      <div style={{ marginTop: 18, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>Discount & Payment</h3>

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
              <option value="credit">Credit</option>
              <option value="check">Check</option>
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
          <div>
            Subtotal: <b>{subtotal}</b>
          </div>
          <div>
            Discount: <b>{discountAmount}</b>
          </div>
          <div>
            Grand Total: <b>{grandTotal}</b>
          </div>

          {paymentMethod === "cash" && (
            <div>
              Balance/Change:{" "}
              <b style={{ color: balance < 0 ? "crimson" : "green" }}>{balance}</b>
              {balance < 0 && <span style={{ marginLeft: 8 }}>(Not enough cash)</span>}
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div style={{ marginTop: 15 }}>
        <h3>Cart</h3>

        {/* Drafts */}
        <div style={{ marginBottom: 12, padding: 10, border: "1px dashed #ccc", borderRadius: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Draft name (optional)"
              style={{ padding: 8, minWidth: 220 }}
            />
            <button onClick={saveDraft} disabled={loading} style={{ padding: 8 }}>
              Save Draft
            </button>
            {draftLoading && <span style={{ fontSize: 12, color: "#666" }}>Loading drafts...</span>}
          </div>

          <div style={{ marginTop: 8 }}>
            {drafts.length === 0 && !draftLoading && (
              <div style={{ fontSize: 12, color: "#666" }}>No drafts saved</div>
            )}
            {drafts.map((d) => (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginTop: 6,
                  padding: "6px 0",
                  borderTop: "1px solid #eee",
                }}
              >
                <div style={{ flex: 1 }}>
                  <b>{d.name || `Draft #${d.id}`}</b>
                  <span style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>
                    {new Date(d.updatedAt).toLocaleString()}
                  </span>
                </div>
                <button onClick={() => loadDraft(d.id)} disabled={loading}>
                  Load
                </button>
                <button onClick={() => deleteDraft(d.id)} disabled={loading}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ color: "#000" }}>
            <tr>
              <th>Barcode</th>
              <th>Item</th>
              <th style={{ width: 120 }}>Price</th>
              <th style={{ width: 120 }}>Qty</th>
              <th style={{ width: 120 }}>Free Qty</th>
              <th style={{ width: 220 }}>Item Discount</th>
              <th style={{ width: 140 }}>Line Total</th>
              <th style={{ width: 100 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {cart.filter((i) => !i.freeIssue).map((i) => (
              <tr key={`${i.barcode}-paid`}>
                <td>{i.barcode}</td>
                <td>{i.name}</td>
                <td>{i.price}</td>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={i.qty}
                    onChange={(e) => changeQty(i.barcode, e.target.value, i.freeIssue)}
                    style={{ width: 80, padding: 6 }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    value={i.freeQty ?? getFreeQtyByBarcode(i.barcode)}
                    onChange={(e) => setFreeQtyForBarcode(i.barcode, e.target.value)}
                    style={{ width: 80, padding: 6 }}
                  />
                </td>
                <td>
  <div style={{ display: "flex", gap: 6 }}>
    <select
      value={i.itemDiscountType || "none"}
      onChange={(e) => changeItemDiscountType(i.barcode, e.target.value, i.freeIssue)}
      disabled={Boolean(i.freeIssue)}
      style={{ padding: 6 }}
    >
      <option value="none">None</option>
      <option value="amount">Rs</option>
      <option value="percent">%</option>
    </select>

    <input
      type="number"
      value={i.itemDiscountValue ?? ""}
      onChange={(e) => changeItemDiscountValue(i.barcode, e.target.value, i.freeIssue)}
      disabled={(i.itemDiscountType || "none") === "none" || Boolean(i.freeIssue)}
      placeholder={(i.itemDiscountType || "none") === "percent" ? "ex: 10" : "ex: 50"}
      style={{ width: 90, padding: 6 }}
    />
  </div>
</td>
                <td>{Math.max(0, getLineBase(i) - getItemDiscountAmount(i))}</td>

                <td>
                  <button onClick={() => removeItem(i.barcode, i.freeIssue)}>Remove</button>
                </td>
              </tr>
            ))}

            {cart.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: "center" }}>
                  Cart is empty
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <h3 style={{ marginTop: 15 }}>Subtotal: {subtotal}</h3>

        <button
          onClick={completeSale}
          disabled={
            loading ||
            cart.length === 0 ||
            (!!customerPhone && digitsOnly(customerPhone).length !== 10) ||
            (requiresStartDay && !dayStarted)
          }
          style={{ padding: 12, fontSize: 16 }}
        >
          Complete Sale
        </button>
      </div>

      <button
        onClick={() =>
          openPrintPreview({
            saleId: "DRAFT",
            dateText: new Date().toLocaleString(),
            items: cart,
            subtotal,
            discount: discountAmount,
            grandTotal,
            paymentMethod,
            cashReceived,
            balance,
            customerName,
            customerPhone,
            customerAddress,
          })
        }
        disabled={cart.length === 0}
        style={{ padding: 12, fontSize: 16, marginLeft: 10 }}
      >
        Print Bill
      </button>

      {/* Trial print (kept) */}
      <button
        onClick={() =>
          openPrintPreview({
            saleId: "TRIAL-001",
            dateText: new Date().toLocaleString(),
            items: cart.length
              ? cart
              : [{ barcode: "trial", name: "Trial Item", qty: 1, price: 150 }],
            subtotal: subtotal || 150,
            discount: discountAmount || 0,
            grandTotal: grandTotal || 150,
            paymentMethod,
            cashReceived: cashReceived || 150,
            balance: balance || 0,
            customerName,
            customerPhone,
            customerAddress,
          })
        }
        style={{ padding: 12, fontSize: 16, marginLeft: 10 }}
      >
        Trial Print
      </button>

      {showPrint && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 99999,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 15,
              borderRadius: 10,
              width: printLayoutMode === "a4" ? "min(980px, 96vw)" : "min(520px, 96vw)",
              maxHeight: "92vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Print Preview</h3>
              <button onClick={() => setShowPrint(false)}>X</button>
            </div>

            <div id="print-area" style={{ marginTop: 10, overflowX: "hidden" }}>
                <ReceiptPrint
                  layout={layoutForPrint}
                  layoutMode={printLayoutMode}
                  saleId={printPayload?.saleId || ""}
                  dateText={printPayload?.dateText || ""}
                  customerName={printPayload?.customerName || ""}
                customerPhone={printPayload?.customerPhone || ""}
                customerAddress={printPayload?.customerAddress || ""}
                items={printPayload?.items || []}
                subtotal={printPayload?.subtotal || 0}
                discount={printPayload?.discount || 0}
                grandTotal={printPayload?.grandTotal || 0}
                paymentMethod={printPayload?.paymentMethod || "cash"}
                cashReceived={printPayload?.cashReceived || 0}
                balance={printPayload?.balance || 0}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={handlePrintNow} style={{ padding: 12, fontSize: 16 }}>
                Print Now
              </button>
              <button
                onClick={() => setShowLayoutEditor((v) => !v)}
                style={{ padding: 12 }}
              >
                {showLayoutEditor ? "Hide Layout" : "Customize Layout"}
              </button>
              <button onClick={() => setShowPrint(false)} style={{ padding: 12 }}>
                Close
              </button>
            </div>

            {showLayoutEditor && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Bill Layout</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <label>
                    Company Name
                    <input
                      value={layoutDraft.companyName || ""}
                      onChange={(e) =>
                        setLayoutDraft((prev) => ({ ...prev, companyName: e.target.value }))
                      }
                      style={{ width: "100%", padding: 6, marginTop: 4 }}
                    />
                  </label>
                  <label>
                    Header Lines (one per line)
                    <textarea
                      rows={2}
                      value={layoutDraft.headerText || ""}
                      onChange={(e) =>
                        setLayoutDraft((prev) => ({ ...prev, headerText: e.target.value }))
                      }
                      style={{ width: "100%", padding: 6, marginTop: 4 }}
                    />
                  </label>
                  <label>
                    Footer Lines (one per line)
                    <textarea
                      rows={2}
                      value={layoutDraft.footerText || ""}
                      onChange={(e) =>
                        setLayoutDraft((prev) => ({ ...prev, footerText: e.target.value }))
                      }
                      style={{ width: "100%", padding: 6, marginTop: 4 }}
                    />
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(layoutDraft.showItemsHeading)}
                      onChange={(e) =>
                        setLayoutDraft((prev) => ({ ...prev, showItemsHeading: e.target.checked }))
                      }
                    />
                    Show items heading
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(layoutDraft.showCustomer)}
                      onChange={(e) =>
                        setLayoutDraft((prev) => ({ ...prev, showCustomer: e.target.checked }))
                      }
                    />
                    Show customer info
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(layoutDraft.showTotals)}
                      onChange={(e) =>
                        setLayoutDraft((prev) => ({ ...prev, showTotals: e.target.checked }))
                      }
                    />
                    Show totals
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(layoutDraft.showPayment)}
                      onChange={(e) =>
                        setLayoutDraft((prev) => ({ ...prev, showPayment: e.target.checked }))
                      }
                    />
                    Show payment
                  </label>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button onClick={saveLayout} style={{ padding: 10 }}>
                    Save Layout
                  </button>
                  <button onClick={resetLayout} style={{ padding: 10 }}>
                    Reset Defaults
                  </button>
                </div>
              </div>
            )}

            {printPaperPrompt && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Print Size</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => confirmPrint("3inch")} style={{ padding: 10 }}>
                    3 Inch
                  </button>
                  <button onClick={() => confirmPrint("a4")} style={{ padding: 10 }}>
                    A4
                  </button>
                  <button onClick={() => setPrintPaperPrompt(false)} style={{ padding: 10 }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}





