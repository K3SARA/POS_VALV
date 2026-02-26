import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { formatNumber } from "../utils/format";

const OUT_PREFIX = "OUTSTANDING:";
const CHEQUE_DUE_PREFIX = "CHEQUE_DUE:";

function normalizeBarcode(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function parseOutstanding(notes) {
  const text = String(notes || "");
  const line = text
    .split("\n")
    .map((v) => v.trim())
    .find((v) => v.toUpperCase().startsWith(OUT_PREFIX));
  if (!line) return 0;
  const raw = line.slice(OUT_PREFIX.length).trim();
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function parseChequeDueDates(notes) {
  const text = String(notes || "");
  return text
    .split("\n")
    .map((v) => v.trim())
    .filter((v) => v.toUpperCase().startsWith(CHEQUE_DUE_PREFIX))
    .map((line) => line.slice(CHEQUE_DUE_PREFIX.length).trim().split("|")[0]?.trim())
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")));
}

function daysUntilDate(dateText) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateText || ""))) return null;
  const [y, m, d] = String(dateText).split("-").map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function upsertOutstanding(notes, value) {
  const safe = Math.max(0, Number(value || 0));
  const text = String(notes || "");
  const lines = text
    .split("\n")
    .map((v) => v.trim())
    .filter((v) => v && !v.toUpperCase().startsWith(OUT_PREFIX));
  return [`${OUT_PREFIX}${Math.round(safe)}`, ...lines].join("\n");
}

function appendChequeDueMarker(notes, chequeDate, saleId) {
  const safeDate = String(chequeDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safeDate)) return String(notes || "");
  const safeSaleId = Number(saleId || 0);
  const marker = safeSaleId > 0 ? `${CHEQUE_DUE_PREFIX}${safeDate}|SALE:${safeSaleId}` : `${CHEQUE_DUE_PREFIX}${safeDate}`;
  const lines = String(notes || "")
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!lines.includes(marker)) lines.push(marker);
  return lines.join("\n");
}

function buildReceiptText(receipt) {
  if (!receipt) return "";
  const lines = [
    "APEX LOGISTICS",
    "--------------------------",
    `Date: ${receipt.date}`,
    "--------------------------",
    `Sale ID: ${receipt.saleId || "-"}`,
    `Customer ID: ${receipt.customerId || "-"}`,
    `Customer: ${receipt.customerName || "-"}`,
    ...(receipt.paymentMethod === "check" && receipt.chequeDate ? [`Cheque Date: ${receipt.chequeDate}`] : []),
    `Payment: ${receipt.paymentMethod}`,
    "------------------------",
  ];
  (receipt.items || []).forEach((item) => {
    const paidQty = Number(item.qty || 0);
    const freeQty = Number(item.freeQty || 0);
    const lineTotal = paidQty * Number(item.price || 0);
    lines.push(`${item.name} (${item.barcode})`);
    lines.push(`  ${paidQty} x ${formatNumber(item.price || 0)} = ${formatNumber(lineTotal)}`);
    if (freeQty > 0) {
      lines.push(`  Free Qty: ${freeQty}`);
    }
  });
  lines.push("------------------------");
  lines.push(`SUBTOTAL: ${formatNumber(receipt.subtotal)}`);
  lines.push(`Discount: ${formatNumber(receipt.discount)}`);
  lines.push(`Bill Total: ${formatNumber(receipt.total)}`);
  lines.push(`Cash Received: ${formatNumber(receipt.cashReceived)}`);
  lines.push(`Outstanding: ${formatNumber(receipt.outstanding)}`);
  lines.push(`Customer Outstanding Now: ${formatNumber(receipt.customerOutstandingNow)}`);
  return lines.join("\n");
}

function CartRow({ item, onQtyChange, onFreeQtyChange, onRemove }) {
  const qty = Number(item.qty || 0);
  const freeQty = Number(item.freeQty || 0);
  const price = Number(item.price || 0);
  const total = qty * price;

  return (
    <View style={styles.cartRow}>
      <View style={styles.cartTop}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.cartName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cartMeta} numberOfLines={1}>Barcode: {item.barcode}</Text>
          <Text style={styles.cartMeta}>Price: {formatNumber(price)}</Text>
        </View>
        <View style={styles.cartAmountBox}>
          <Text style={styles.rowTotal}>{formatNumber(total)}</Text>
          <Pressable onPress={() => onRemove(item.barcode)}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.cartControls}>
        <View style={styles.qtyBox}>
          <Text style={styles.freeLabel}>Qty</Text>
          <Pressable style={styles.qtyButton} onPress={() => onQtyChange(item.barcode, Math.max(1, qty - 1))}>
            <Text style={styles.qtyButtonText}>-</Text>
          </Pressable>
          <TextInput
            value={String(qty)}
            onChangeText={(v) => onQtyChange(item.barcode, Number(v || 0))}
            keyboardType="numeric"
            style={styles.qtyInput}
          />
          <Pressable style={styles.qtyButton} onPress={() => onQtyChange(item.barcode, qty + 1)}>
            <Text style={styles.qtyButtonText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.freeQtyBox}>
          <Text style={styles.freeLabel}>Free</Text>
          <Pressable style={styles.qtyButton} onPress={() => onFreeQtyChange(item.barcode, Math.max(0, freeQty - 1))}>
            <Text style={styles.qtyButtonText}>-</Text>
          </Pressable>
          <TextInput
            value={String(freeQty)}
            onChangeText={(v) => onFreeQtyChange(item.barcode, Number(v || 0))}
            keyboardType="numeric"
            style={styles.qtyInput}
          />
          <Pressable style={styles.qtyButton} onPress={() => onFreeQtyChange(item.barcode, freeQty + 1)}>
            <Text style={styles.qtyButtonText}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function PanelTitle({ icon, label }) {
  return (
    <View style={styles.panelTitleRow}>
      <Ionicons name={icon} size={18} color="#0f766e" />
      <Text style={styles.panelTitleText}>{label}</Text>
    </View>
  );
}

export default function CashierScreen() {
  const { username, role } = useAuth();
  const placeholderColor = "#6b7280";
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [outstandingMap, setOutstandingMap] = useState({});
  const [cart, setCart] = useState([]);
  const [barcode, setBarcode] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [showChequeDatePicker, setShowChequeDatePicker] = useState(false);
  const [dismissedChequeAlertKey, setDismissedChequeAlertKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [showCustomerNameDropdown, setShowCustomerNameDropdown] = useState(false);
  const [showCustomerPhoneDropdown, setShowCustomerPhoneDropdown] = useState(false);
  const [selectedItemRow, setSelectedItemRow] = useState("");
  const [selectedCustomerRow, setSelectedCustomerRow] = useState("");
  const [activeTouchRow, setActiveTouchRow] = useState("");
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [pendingSales, setPendingSales] = useState([]);
  const [pendingSalesLoading, setPendingSalesLoading] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [selectedPendingSaleId, setSelectedPendingSaleId] = useState(null);
  const [dayStarted, setDayStarted] = useState(false);
  const [dayRoute, setDayRoute] = useState("");
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeInput, setRouteInput] = useState("");
  const [routes, setRoutes] = useState([]);
  const [dayStatusLoading, setDayStatusLoading] = useState(true);
  const requiresStartDay = role === "cashier";
  const canUseCashierActions = !requiresStartDay || (dayStarted && !dayStatusLoading);


  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productsData, customersData, outstandingData] = await Promise.all([
        apiFetch("/products"),
        apiFetch("/customers"),
        apiFetch("/reports/customer-outstanding"),
      ]);
      const productList = Array.isArray(productsData) ? productsData : productsData?.items || [];
      setProducts(productList);
      setCustomers(Array.isArray(customersData) ? customersData : []);
      const map = {};
      (outstandingData?.rows || []).forEach((row) => {
        if (row?.customerId) {
          map[row.customerId] = Number(row.outstanding || 0);
        }
      });
      setOutstandingMap(map);
    } catch (e) {
      setError(e.message || "Failed to load cashier data");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPendingSales = useCallback(async () => {
    try {
      setPendingSalesLoading(true);
      const data = await apiFetch("/pending-sales");
      const list = Array.isArray(data) ? data : [];
      setPendingSales(list.filter((r) => String(r?.pending?.status || "pending") === "pending"));
    } catch {
      setPendingSales([]);
    } finally {
      setPendingSalesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);
  React.useEffect(() => {
    loadPendingSales();
  }, [loadPendingSales]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadPendingSales();
    }, [loadData, loadPendingSales])
  );

  const loadDayStatus = useCallback(async () => {
    setDayStatusLoading(true);
    try {
      const [data, routeRows] = await Promise.all([
        apiFetch("/cashier/day/status"),
        apiFetch("/routes"),
      ]);
      setDayStarted(Boolean(data?.started));
      setDayRoute(String(data?.session?.route || ""));
      setRoutes(Array.isArray(routeRows) ? routeRows : []);
      setShowRouteModal(!Boolean(data?.started));
      if (data?.started) {
        setRouteInput(String(data?.session?.route || ""));
      } else {
        setRouteInput("");
      }
    } catch {
      setDayStarted(false);
      setDayRoute("");
      setRoutes([]);
      setShowRouteModal(true);
    } finally {
      setDayStatusLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!requiresStartDay) {
      setDayStarted(true);
      setShowRouteModal(false);
      setDayStatusLoading(false);
      return;
    }
    loadDayStatus();
  }, [loadDayStatus, requiresStartDay]);

  const barcodeSuggestions = useMemo(() => {
    const q = barcode.trim().toLowerCase();
    return products
      .filter((p) => Number(p.stock || 0) > 0)
      .filter((p) => {
        if (!q) return true;
        const name = String(p.name || "").toLowerCase();
        const code = String(p.barcode || "").toLowerCase();
        return code.includes(q) || name.includes(q);
      })
      .slice(0, 12);
  }, [products, barcode]);

  const customerNameSuggestions = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (!q) return true;
        const name = String(c.name || "").toLowerCase();
        const phone = String(c.phone || "").toLowerCase();
        return name.includes(q) || phone.includes(q);
      })
      .slice(0, 20);
  }, [customers, customerName]);

  const customerPhoneSuggestions = useMemo(() => {
    const q = customerPhone.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (!q) return true;
        const name = String(c.name || "").toLowerCase();
        const phone = String(c.phone || "").toLowerCase();
        return phone.includes(q) || name.includes(q);
      })
      .slice(0, 20);
  }, [customers, customerPhone]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const customerOutstandingNow = selectedCustomer
    ? Math.max(
        Number(outstandingMap[selectedCustomer.id] || 0),
        parseOutstanding(selectedCustomer.notes)
      )
    : 0;

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const value = Number(discountValue || 0);
    if (discountType === "amount") return Math.max(0, Math.min(value, subtotal));
    if (discountType === "percent") {
      const pct = Math.max(0, Math.min(value, 100));
      return (subtotal * pct) / 100;
    }
    return 0;
  }, [discountType, discountValue, subtotal]);

  const billTotal = Math.max(0, subtotal - discountAmount);
  const hasCashInput = String(cashReceived || "").trim().length > 0;
  const cashInputNumber = Number(cashReceived || 0);
  const normalizedCashReceived = Number.isFinite(cashInputNumber)
    ? Math.max(0, cashInputNumber)
    : paymentMethod === "cash" && !hasCashInput
      ? billTotal
      : 0;
  const saleOutstanding = paymentMethod === "credit" ? billTotal : Math.max(0, billTotal - normalizedCashReceived);
  const customerOutstandingAfterSale = Math.max(0, customerOutstandingNow + billTotal - normalizedCashReceived);

  const chequeAlertsDueInTwoDays = useMemo(() => {
    const rows = [];
    for (const c of customers) {
      const dates = parseChequeDueDates(c?.notes);
      for (const dt of dates) {
        if (daysUntilDate(dt) === 2) {
          rows.push({
            customerId: c.id,
            customerName: c.name || "Customer",
            date: dt,
          });
        }
      }
    }
    return rows.sort((a, b) => String(a.customerName).localeCompare(String(b.customerName)));
  }, [customers]);
  const activeChequeAlert = chequeAlertsDueInTwoDays[0] || null;
  const activeChequeAlertKey = activeChequeAlert
    ? `${activeChequeAlert.customerId}|${activeChequeAlert.date}`
    : "";

  function closeAllDropdowns() {
    setShowItemDropdown(false);
    setShowCustomerNameDropdown(false);
    setShowCustomerPhoneDropdown(false);
  }

  function getCartQty(code) {
    return cart.reduce((sum, item) => {
      if (item.barcode === code) return sum + Number(item.qty || 0) + Number(item.freeQty || 0);
      return sum;
    }, 0);
  }

  function ensureDayStartedForAction() {
    if (!requiresStartDay) return true;
    if (dayStarted) return true;
    setError("Tap Start Day before billing.");
    setShowRouteModal(true);
    return false;
  }

  async function startDay() {
    try {
      setLoading(true);
      setError("");
      const data = await apiFetch("/cashier/day/start", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setDayStarted(true);
      setDayRoute(String(data?.session?.route || ""));
      setShowRouteModal(false);
      setMessage(`Day started${data?.session?.route ? ` (${data.session.route})` : ""}`);
    } catch (e) {
      setError(e.message || "Failed to start day");
    } finally {
      setLoading(false);
    }
  }

  async function endDay() {
    try {
      setLoading(true);
      setError("");
      await apiFetch("/cashier/day/end", { method: "POST" });
      setDayStarted(false);
      setDayRoute("");
      setRouteInput("");
      setShowRouteModal(true);
      setMessage("Day ended");
    } catch (e) {
      setError(e.message || "Failed to end day");
    } finally {
      setLoading(false);
    }
  }

  async function addToCartByBarcode(code) {
    if (!ensureDayStartedForAction()) return;
    const clean = normalizeBarcode(code);
    if (!clean) return;

    let product = products.find((p) => normalizeBarcode(p.barcode) === clean);
    if (!product) {
      try {
        const exactCode = String(code || "").trim().replace(/\s+/g, "");
        const fetched = await apiFetch(`/products/${encodeURIComponent(exactCode)}`);
        if (fetched?.barcode) {
          product = fetched;
          setProducts((prev) => {
            const exists = prev.some((p) => normalizeBarcode(p.barcode) === normalizeBarcode(fetched.barcode));
            return exists ? prev : [fetched, ...prev];
          });
        }
      } catch {
        // use not found error
      }
    }

    if (!product) {
      setError("Product not found");
      return;
    }

    const inCartQty = getCartQty(product.barcode);
    if (Number(product.stock || 0) <= inCartQty) {
      setError("Out of stock");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.barcode === product.barcode);
      if (existing) {
        return prev.map((item) =>
          item.barcode === product.barcode ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1, freeQty: 0 }];
    });
    setBarcode("");
    setError("");
    setShowItemDropdown(false);
  }

  function changeQty(code, nextQty) {
    if (!ensureDayStartedForAction()) return;
    const qty = Number(nextQty || 0);
    if (!Number.isFinite(qty) || qty < 1) return;
    const product = products.find((p) => p.barcode === code);
    const stock = Number(product?.stock || 0);
    const existing = cart.find((item) => item.barcode === code);
    const freeQty = Number(existing?.freeQty || 0);
    if (qty + freeQty > stock) {
      setError(`Only ${formatNumber(stock)} available for ${code}`);
      return;
    }
    setCart((prev) => prev.map((item) => (item.barcode === code ? { ...item, qty } : item)));
  }

  function changeFreeQty(code, nextQty) {
    if (!ensureDayStartedForAction()) return;
    const qty = Number(nextQty || 0);
    if (!Number.isFinite(qty) || qty < 0) return;
    const existing = cart.find((item) => item.barcode === code);
    const paidQty = Number(existing?.qty || 0);
    const product = products.find((p) => p.barcode === code);
    const stock = Number(product?.stock || 0);
    if (paidQty + qty > stock) {
      setError(`Only ${formatNumber(stock)} available for ${code}`);
      return;
    }
    setCart((prev) => prev.map((item) => (item.barcode === code ? { ...item, freeQty: qty } : item)));
  }

  function removeItem(code) {
    if (!ensureDayStartedForAction()) return;
    setCart((prev) => prev.filter((item) => item.barcode !== code));
  }

  function onChequeDateChange(event, selected) {
    if (Platform.OS === "android") setShowChequeDatePicker(false);
    if (selected) setChequeDate(formatDateInput(selected));
  }

  function chooseCustomer(customer) {
    if (!ensureDayStartedForAction()) return;
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name || "");
    setCustomerPhone(customer.phone || "");
    setCustomerAddress(customer.address || "");
    setSelectedCustomerRow(String(customer.id));
    closeAllDropdowns();
  }

  function clearCashierForm() {
    setCart([]);
    setBarcode("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setSelectedCustomerId(null);
    setSelectedItemRow("");
    setSelectedCustomerRow("");
    setActiveTouchRow("");
    setShowItemDropdown(false);
    setShowCustomerNameDropdown(false);
    setShowCustomerPhoneDropdown(false);
    setDiscountType("none");
    setDiscountValue("");
    setPaymentMethod("cash");
    setCashReceived("");
    setChequeDate("");
    setSelectedPendingSaleId(null);
  }

  function applyPendingSaleToForm(row) {
    const payload = row?.pending?.payload || {};
    const items = Array.isArray(payload.items) ? payload.items : [];
    const productMap = new Map((products || []).map((p) => [String(p.barcode || ""), p]));
    const nextCart = items
      .map((it) => {
        const code = String(it?.barcode || "").trim();
        if (!code) return null;
        const p = productMap.get(code) || {};
        return {
          ...p,
          barcode: code,
          name: p?.name || it?.name || code,
          price: Number(p?.price ?? p?.billingPrice ?? it?.price ?? 0) || 0,
          stock: Number(p?.stock ?? it?.stock ?? 0) || 0,
          qty: Math.max(1, Number(it?.qty || 0) || 1),
          freeQty: Math.max(0, Number(it?.freeQty || 0) || 0),
        };
      })
      .filter(Boolean);
    const customer = payload.customer || {};
    setCart(nextCart);
    setCustomerName(String(customer?.name || ""));
    setCustomerPhone(String(customer?.phone || ""));
    setCustomerAddress(String(customer?.address || ""));
    setSelectedCustomerId(customer?.id || null);
    setDiscountType(String(payload.discountType || "none"));
    setDiscountValue(String(payload.discountValue ?? ""));
    setPaymentMethod(String(payload.paymentMethod || "cash"));
    setCashReceived(String(payload.cashReceived ?? ""));
    setChequeDate(String(payload.chequeDate || ""));
    setSelectedPendingSaleId(row?.id || null);
    setShowPendingModal(false);
    setMessage(`Loaded pending request #${row?.id || ""}`);
    setError("");
  }

  async function updateCustomerOutstanding(newOutstanding, opts = {}) {
    const targetCustomerId = opts.customerId || selectedCustomerId;
    if (!targetCustomerId) return;
    const target = customers.find((c) => c.id === targetCustomerId);
    if (!target) return;
    let nextNotes = upsertOutstanding(target.notes, newOutstanding);
    if (opts.paymentMethod === "check" && opts.chequeDate) {
      nextNotes = appendChequeDueMarker(nextNotes, opts.chequeDate, opts.saleId);
    }
    try {
      const updated = await apiFetch(`/customers/${targetCustomerId}`, {
        method: "PUT",
        body: JSON.stringify({
          notes: nextNotes,
          name: target.name,
          phone: target.phone,
          address: target.address,
        }),
      });
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setOutstandingMap((prev) => ({ ...prev, [targetCustomerId]: Number(newOutstanding || 0) }));
    } catch {
      // keep sale success even if notes update fails
    }
  }

  async function completeSale() {
    if (!ensureDayStartedForAction()) return;
    if (cart.length === 0) {
      setError("Cart is empty");
      return;
    }

    if (paymentMethod === "cash" && normalizedCashReceived < billTotal && !selectedCustomerId && !customerName.trim()) {
      setError("Select customer for partial cash payments");
      return;
    }
    if (paymentMethod === "check") {
      const cd = String(chequeDate || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cd)) {
        setError("Cheque date is required (YYYY-MM-DD)");
        return;
      }
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        items: cart.map((item) => ({
          barcode: item.barcode,
          qty: Number(item.qty || 0),
          freeQty: Number(item.freeQty || 0),
        })),
        paymentMethod,
        discountType,
        discountValue: Number(discountValue || 0),
        cashReceived: paymentMethod === "cash" ? normalizedCashReceived : 0,
        chequeDate: paymentMethod === "check" ? String(chequeDate || "").trim() : null,
      };

      if (customerName.trim()) {
        payload.customer = {
          ...(selectedCustomerId ? { id: selectedCustomerId } : {}),
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: customerAddress.trim(),
        };
      }

      if (role === "cashier") {
        const isUpdate = Boolean(selectedPendingSaleId);
        await apiFetch(isUpdate ? `/pending-sales/${selectedPendingSaleId}` : "/pending-sales", {
          method: isUpdate ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
        clearCashierForm();
        setMessage(isUpdate ? "Pending sale request updated" : "Sale request sent for admin approval");
        await loadData();
        await loadPendingSales();
        return;
      }

      const saleResponse = await apiFetch("/sales", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const approvingPending = Boolean(selectedPendingSaleId);
      if (selectedPendingSaleId) {
        await apiFetch(`/pending-sales/${selectedPendingSaleId}/approve`, {
          method: "POST",
          body: JSON.stringify({ saleId: saleResponse?.sale?.id || null }),
        });
      }

      await updateCustomerOutstanding(customerOutstandingAfterSale, {
        customerId: saleResponse?.sale?.customerId || selectedCustomerId || null,
        paymentMethod,
        chequeDate: paymentMethod === "check" ? chequeDate : "",
        saleId: saleResponse?.sale?.id || null,
      });

      setLastReceipt({
        saleId: saleResponse?.sale?.id || "",
        customerId: saleResponse?.sale?.customerId || selectedCustomerId || "",
        date: new Date().toLocaleString(),
        items: cart,
        subtotal,
        discount: discountAmount,
        total: billTotal,
        paymentMethod,
        chequeDate: paymentMethod === "check" ? String(chequeDate || "").trim() : "",
        cashReceived: normalizedCashReceived,
        outstanding: saleOutstanding,
        customerOutstandingNow: customerOutstandingAfterSale,
        customerName,
      });
      setShowPrintPreview(true);

      clearCashierForm();
      setMessage(approvingPending ? "Pending sale approved and completed" : "Sale completed");
      await loadData();
      await loadPendingSales();
    } catch (e) {
      setError(e.message || "Failed to complete sale");
    } finally {
      setLoading(false);
    }
  }

  async function onPrintReceipt() {
    try {
      await Share.share({ message: buildReceiptText(lastReceipt) });
    } catch {
      Alert.alert("Print", "Unable to open print/share dialog on this device.");
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Cashier | {username || "User"}</Text>
        {activeChequeAlert && dismissedChequeAlertKey !== activeChequeAlertKey ? (
          <View style={styles.chequeAlert}>
            <Text style={styles.chequeAlertText}>
              Cheque alert (2 days): {activeChequeAlert.customerName} - {activeChequeAlert.date}
              {chequeAlertsDueInTwoDays.length > 1 ? ` (+${chequeAlertsDueInTwoDays.length - 1} more)` : ""}
            </Text>
            <Pressable
              onPress={() => setDismissedChequeAlertKey(activeChequeAlertKey)}
              hitSlop={8}
              style={styles.chequeAlertClose}
            >
              <Ionicons name="close" size={16} color="#92400e" />
            </Pressable>
          </View>
        ) : null}
        {requiresStartDay ? (
          <View style={styles.dayBar}>
            <Text style={styles.dayStatusText}>
              {dayStatusLoading
                ? "Checking day status..."
                : dayStarted
                  ? `Day Started - Route: ${dayRoute || "-"}`
                  : "Day Not Started"}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {!dayStarted ? (
                <Pressable style={styles.smallBtn} onPress={() => setShowRouteModal(true)}>
                  <Text style={styles.smallBtnText}>Start Day</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.smallBtn, styles.smallBtnDanger]}
                  onPress={endDay}
                >
                  <Text style={styles.smallBtnText}>End Day</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : null}
        {requiresStartDay && !dayStarted && !dayStatusLoading ? (
          <Text style={styles.dayWarn}>Cashier actions are locked until Start Day is completed.</Text>
        ) : null}
        {loading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <View style={styles.pendingToolbar}>
          <Pressable
            style={[styles.smallBtn, (!canUseCashierActions && role === "cashier") && styles.btnDisabled]}
            onPress={() => setShowPendingModal(true)}
          >
            <Text style={styles.smallBtnText}>
              Pending {pendingSalesLoading ? "..." : `(${pendingSales.length})`}
            </Text>
          </Pressable>
          {selectedPendingSaleId ? (
            <Pressable
              style={[styles.smallBtn, { backgroundColor: "#475569" }]}
              onPress={() => {
                setSelectedPendingSaleId(null);
                setMessage("Pending edit cleared");
              }}
            >
              <Text style={styles.smallBtnText}>Clear Pending Edit</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.panel, { zIndex: 20 }]}>
          <PanelTitle icon="barcode-outline" label="Add Item" />
          <View style={styles.inline}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={barcode}
              onChangeText={(v) => {
                setBarcode(v);
                setShowItemDropdown(true);
                setShowCustomerNameDropdown(false);
                setShowCustomerPhoneDropdown(false);
              }}
              onFocus={() => setShowItemDropdown(true)}
              onBlur={() => setTimeout(() => setShowItemDropdown(false), 120)}
              placeholder="Barcode/Name"
              placeholderTextColor={placeholderColor}
              editable={canUseCashierActions}
            />
            <Pressable
              style={[styles.action, !canUseCashierActions && styles.btnDisabled]}
              onPress={() => void addToCartByBarcode(barcode)}
              disabled={!canUseCashierActions}
            >
              <Text style={styles.actionText}>Add</Text>
            </Pressable>
          </View>

          {showItemDropdown ? (
            <View style={styles.suggestBox}>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="always"
                style={{ maxHeight: 240 }}
              >
                {barcodeSuggestions.length === 0 ? (
                  <Text style={styles.suggestEmpty}>No in-stock items found</Text>
                ) : (
                  barcodeSuggestions.map((item) => {
                    const key = String(item.id || item.barcode);
                    const inCartQty = getCartQty(item.barcode);
                    return (
                      <Pressable
                        key={key}
                        style={[
                          styles.suggestRow,
                          activeTouchRow === `item-${key}` && styles.suggestRowPressed,
                          selectedItemRow === key && styles.suggestRowSelected,
                        ]}
                        onPressIn={() => {
                          setActiveTouchRow(`item-${key}`);
                        }}
                        onPressOut={() => {
                          setActiveTouchRow("");
                        }}
                        onPress={() => {
                          setSelectedItemRow(key);
                          void addToCartByBarcode(item.barcode);
                        }}
                      >
                        <Text style={styles.listName}>{item.name}</Text>
                        <Text style={styles.listMeta}>
                          {item.barcode} | Stock: {formatNumber(item.stock || 0)} | Price: {formatNumber(item.price || 0)}
                          {inCartQty > 0 ? ` | In cart: ${inCartQty}` : ""}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          ) : null}

        </View>

        <View style={[styles.panel, { zIndex: 10 }]}>
          <PanelTitle icon="person-outline" label="Customer" />
          <TextInput
            style={styles.input}
            value={customerName}
            onChangeText={(v) => {
              setCustomerName(v);
              setSelectedCustomerId(null);
              setShowCustomerNameDropdown(true);
              setShowItemDropdown(false);
              setShowCustomerPhoneDropdown(false);
            }}
            onFocus={() => {
              setShowCustomerNameDropdown(true);
              setShowItemDropdown(false);
              setShowCustomerPhoneDropdown(false);
            }}
            onBlur={() => setTimeout(() => setShowCustomerNameDropdown(false), 120)}
            placeholder="Name (optional)"
            placeholderTextColor={placeholderColor}
            editable={canUseCashierActions}
          />
          {showCustomerNameDropdown ? (
            <View style={styles.suggestBox}>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="always"
                style={{ maxHeight: 220 }}
              >
                {customerNameSuggestions.length === 0 ? (
                  <Text style={styles.suggestEmpty}>No customers found</Text>
                ) : (
                  customerNameSuggestions.map((customer) => (
                    <Pressable
                      key={customer.id}
                      style={[
                        styles.suggestRow,
                        activeTouchRow === `cname-${customer.id}` && styles.suggestRowPressed,
                        selectedCustomerRow === customer.id && styles.suggestRowSelected,
                      ]}
                      onPressIn={() => setActiveTouchRow(`cname-${customer.id}`)}
                      onPressOut={() => setActiveTouchRow("")}
                      onPress={() => chooseCustomer(customer)}
                    >
                      <Text style={styles.listName}>{customer.name}</Text>
                      <Text style={styles.listMeta}>{customer.phone || "-"} | {customer.address || "-"}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            value={customerPhone}
            onChangeText={(v) => {
              setCustomerPhone(v);
              setSelectedCustomerId(null);
              setShowCustomerPhoneDropdown(true);
              setShowItemDropdown(false);
              setShowCustomerNameDropdown(false);
            }}
            onFocus={() => {
              setShowCustomerPhoneDropdown(true);
              setShowItemDropdown(false);
              setShowCustomerNameDropdown(false);
            }}
            onBlur={() => setTimeout(() => setShowCustomerPhoneDropdown(false), 120)}
            placeholder="Phone"
            placeholderTextColor={placeholderColor}
            editable={canUseCashierActions}
          />
          {showCustomerPhoneDropdown ? (
            <View style={styles.suggestBox}>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="always"
                style={{ maxHeight: 220 }}
              >
                {customerPhoneSuggestions.length === 0 ? (
                  <Text style={styles.suggestEmpty}>No customers found</Text>
                ) : (
                  customerPhoneSuggestions.map((customer) => (
                    <Pressable
                      key={customer.id}
                      style={[
                        styles.suggestRow,
                        activeTouchRow === `cphone-${customer.id}` && styles.suggestRowPressed,
                        selectedCustomerRow === customer.id && styles.suggestRowSelected,
                      ]}
                      onPressIn={() => setActiveTouchRow(`cphone-${customer.id}`)}
                      onPressOut={() => setActiveTouchRow("")}
                      onPress={() => chooseCustomer(customer)}
                    >
                      <Text style={styles.listName}>{customer.name}</Text>
                      <Text style={styles.listMeta}>{customer.phone || "-"} | {customer.address || "-"}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            value={customerAddress}
            onChangeText={setCustomerAddress}
            placeholder="Address"
            placeholderTextColor={placeholderColor}
            editable={canUseCashierActions}
          />
          <Text
            style={[
              styles.customerOutLine,
              customerOutstandingNow > 0 ? styles.customerOutLineWarn : null,
            ]}
          >
            Customer Outstanding: {formatNumber(customerOutstandingNow)}
          </Text>
          <Text style={styles.customerOutLine}>After This Sale: {formatNumber(customerOutstandingAfterSale)}</Text>
        </View>

        <View style={styles.panel}>
          <PanelTitle icon="cart-outline" label="Cart" />
          {cart.length === 0 ? (
            <Text style={styles.empty}>Cart is empty</Text>
          ) : (
            cart.map((item) => (
              <CartRow
                key={String(item.barcode)}
                item={item}
                onQtyChange={changeQty}
                onFreeQtyChange={changeFreeQty}
                onRemove={removeItem}
              />
            ))
          )}
        </View>

        <View style={styles.panel}>
          <PanelTitle icon="card-outline" label="Payment" />
          <Text style={styles.meta}>Payment method</Text>
          <View style={styles.inline}>
            {["cash", "card", "credit", "check"].map((method) => (
              <Pressable
                key={method}
                style={[
                  styles.methodChip,
                  paymentMethod === method && styles.methodChipActive,
                  !canUseCashierActions && styles.btnDisabled,
                ]}
                onPress={() => {
                  if (!ensureDayStartedForAction()) return;
                  setPaymentMethod(method);
                  if (method === "credit") setCashReceived("");
                }}
                disabled={!canUseCashierActions}
              >
                <Text style={[styles.methodText, paymentMethod === method && styles.methodTextActive]}>
                  {method === "check" ? "cheque" : method}
                </Text>
              </Pressable>
            ))}
          </View>

          {paymentMethod !== "credit" ? (
            <>
              <Text style={[styles.meta, { marginTop: 8 }]}>Cash Received</Text>
              <TextInput
                style={styles.input}
                value={cashReceived}
                onChangeText={setCashReceived}
                placeholder="Enter received cash"
                placeholderTextColor={placeholderColor}
                keyboardType="numeric"
                editable={canUseCashierActions}
              />
            </>
          ) : null}

          {paymentMethod === "check" ? (
            <>
              <Text style={[styles.meta, { marginTop: 4 }]}>Cheque Date (YYYY-MM-DD)</Text>
              <Pressable
                style={[styles.input, styles.dateInputBtn, !canUseCashierActions && styles.btnDisabled]}
                onPress={() => canUseCashierActions && setShowChequeDatePicker(true)}
                disabled={!canUseCashierActions}
              >
                <Text style={[styles.dateInputText, !chequeDate && { color: placeholderColor }]}>
                  {chequeDate || "Select cheque date"}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#4b5563" />
              </Pressable>
              {showChequeDatePicker ? (
                <DateTimePicker
                  value={/^\d{4}-\d{2}-\d{2}$/.test(chequeDate) ? new Date(`${chequeDate}T00:00:00`) : new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onChequeDateChange}
                />
              ) : null}
            </>
          ) : null}

          <Text style={[styles.meta, { marginTop: 8 }]}>Discount</Text>
          <View style={styles.inline}>
            {["none", "amount", "percent"].map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.methodChip,
                  discountType === type && styles.methodChipActive,
                  !canUseCashierActions && styles.btnDisabled,
                ]}
                onPress={() => {
                  if (!ensureDayStartedForAction()) return;
                  setDiscountType(type);
                }}
                disabled={!canUseCashierActions}
              >
                <Text style={[styles.methodText, discountType === type && styles.methodTextActive]}>{type}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={discountValue}
            onChangeText={setDiscountValue}
            editable={discountType !== "none" && canUseCashierActions}
            placeholder={discountType === "percent" ? "Percent" : "Amount"}
            placeholderTextColor={placeholderColor}
            keyboardType="numeric"
          />

          <Text style={styles.total}>Subtotal: {formatNumber(subtotal)}</Text>
          <Text style={styles.total}>Discount: {formatNumber(discountAmount)}</Text>
          <Text style={styles.grandTotal}>Bill Total: {formatNumber(billTotal)}</Text>
          <Text style={styles.total}>Cash Received: {formatNumber(normalizedCashReceived)}</Text>
          <Text style={styles.total}>This Sale Outstanding: {formatNumber(saleOutstanding)}</Text>
          <Pressable
            style={[styles.completeButton, !canUseCashierActions && styles.btnDisabled]}
            onPress={completeSale}
            disabled={!canUseCashierActions}
          >
            <Text style={styles.completeText}>
              {role === "cashier"
                ? (selectedPendingSaleId ? "Update Request" : "Request Sale")
                : (selectedPendingSaleId ? "Approve & Complete" : "Complete Sale")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={showPendingModal} transparent animationType="fade" onRequestClose={() => setShowPendingModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.pendingModalHeader}>
              <Text style={styles.modalTitle}>Pending Sales</Text>
              <Pressable style={styles.closeBtn} onPress={() => setShowPendingModal(false)}>
                <Text style={styles.closeBtnText}>Close</Text>
              </Pressable>
            </View>
            <Pressable style={[styles.action, { marginBottom: 10 }]} onPress={loadPendingSales}>
              <Text style={styles.actionText}>{pendingSalesLoading ? "Refreshing..." : "Refresh Pending"}</Text>
            </Pressable>
            <ScrollView style={{ maxHeight: 360 }}>
              {pendingSales.length === 0 ? (
                <Text style={styles.meta}>No pending sales</Text>
              ) : (
                pendingSales.map((row) => {
                  const payload = row?.pending?.payload || {};
                  const itemCount = (payload?.items || []).reduce(
                    (sum, it) => sum + Number(it?.qty || 0) + Number(it?.freeQty || 0),
                    0
                  );
                  const selected = Number(selectedPendingSaleId || 0) === Number(row.id || 0);
                  return (
                    <Pressable
                      key={String(row.id)}
                      style={[styles.pendingRow, selected && styles.pendingRowSelected]}
                      onPress={() => applyPendingSaleToForm(row)}
                    >
                      <Text style={styles.pendingRowTitle}>
                        #{row.id} {payload?.customer?.name ? `| ${payload.customer.name}` : ""}
                      </Text>
                      <Text style={styles.pendingRowMeta}>
                        {String(payload?.paymentMethod || "cash")} | Items: {formatNumber(itemCount)}
                      </Text>
                      <Text style={styles.pendingRowMeta}>
                        {row?.updatedAt ? new Date(row.updatedAt).toLocaleString() : ""}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={requiresStartDay && showRouteModal} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Start Day</Text>
            <Text style={styles.meta}>Start day once before billing</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.action} onPress={startDay}>
                <Text style={styles.actionText}>Start Day</Text>
              </Pressable>
              <Pressable style={styles.closeBtn} onPress={() => setShowRouteModal(false)}>
                <Text style={styles.closeBtnText}>Close</Text>
              </Pressable>
            </View>
            {!dayStarted ? (
              <Text style={[styles.meta, { marginTop: 8 }]}>Cashier actions stay locked until Start Day.</Text>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={showPrintPreview} transparent animationType="fade" onRequestClose={() => setShowPrintPreview(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Print Preview</Text>
            <ScrollView style={styles.previewBox}>
              <Text style={styles.previewText}>{buildReceiptText(lastReceipt)}</Text>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.action} onPress={onPrintReceipt}>
                <Text style={styles.actionText}>Print</Text>
              </Pressable>
              <Pressable style={styles.closeBtn} onPress={() => setShowPrintPreview(false)}>
                <Text style={styles.closeBtnText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
    padding: 14,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  dayBar: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  dayStatusText: {
    color: "#111827",
    fontWeight: "700",
    flexShrink: 1,
  },
  smallBtn: {
    backgroundColor: "#1d4ed8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  smallBtnDanger: {
    backgroundColor: "#b91c1c",
  },
  smallBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  dayWarn: {
    color: "#b91c1c",
    marginBottom: 8,
    fontWeight: "600",
  },
  pendingToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  chequeAlert: {
    backgroundColor: "#fef3c7",
    borderColor: "#fcd34d",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  chequeAlertText: {
    color: "#92400e",
    fontWeight: "600",
    flex: 1,
  },
  chequeAlertClose: {
    paddingTop: 1,
  },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  panelTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: "#111827",
    marginBottom: 8,
  },
  panelTitleText: {
    fontWeight: "700",
    fontSize: 16,
    color: "#111827",
    lineHeight: 20,
  },
  panelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  input: {
    backgroundColor: "#fff",
    color: "#111827",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  action: {
    backgroundColor: "#1d4ed8",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionText: {
    color: "#fff",
    fontWeight: "700",
  },
  pendingModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  pendingRow: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  pendingRowSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  pendingRowTitle: {
    color: "#111827",
    fontWeight: "700",
    marginBottom: 2,
  },
  pendingRowMeta: {
    color: "#4b5563",
    fontSize: 12,
  },
  dateInputBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateInputText: {
    color: "#111827",
    fontWeight: "500",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  suggestBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 8,
    overflow: "hidden",
    zIndex: 30,
  },
  suggestRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  suggestRowPressed: {
    backgroundColor: "#dbeafe",
    borderLeftColor: "#2563eb",
  },
  suggestRowSelected: {
    backgroundColor: "#bfdbfe",
    borderLeftColor: "#1d4ed8",
  },
  suggestEmpty: {
    padding: 10,
    color: "#6b7280",
  },
  listName: {
    fontWeight: "600",
    color: "#111827",
  },
  listMeta: {
    color: "#4b5563",
    fontSize: 12,
  },
  customerOutLine: {
    color: "#1f2937",
    fontWeight: "600",
    marginBottom: 4,
  },
  customerOutLineWarn: {
    color: "#b91c1c",
  },
  cartRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cartTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cartAmountBox: {
    alignItems: "flex-end",
    minWidth: 72,
  },
  cartControls: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  freeQtyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  freeLabel: {
    color: "#1f2937",
    fontWeight: "600",
    minWidth: 34,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e7eb",
  },
  qtyInput: {
    width: 44,
    height: 30,
    color: "#111827",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    textAlign: "center",
    backgroundColor: "#fff",
    paddingVertical: 0,
  },
  qtyButtonText: {
    fontWeight: "700",
    color: "#111827",
  },
  rowTotal: {
    fontWeight: "700",
    color: "#111827",
  },
  remove: {
    color: "#b91c1c",
    fontSize: 12,
    marginTop: 2,
  },
  cartRowLegacy: {
    paddingVertical: 8,
  },
  cartName: {
    fontWeight: "700",
    color: "#111827",
  },
  cartMeta: {
    color: "#4b5563",
    fontSize: 12,
  },
  methodChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  methodChipActive: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  methodText: {
    color: "#374151",
    fontWeight: "600",
  },
  methodTextActive: {
    color: "#fff",
  },
  meta: {
    color: "#4b5563",
    marginBottom: 6,
  },
  total: {
    color: "#111827",
    fontWeight: "600",
  },
  grandTotal: {
    marginTop: 4,
    color: "#111827",
    fontWeight: "700",
    fontSize: 17,
  },
  completeButton: {
    marginTop: 10,
    backgroundColor: "#15803d",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  completeText: {
    color: "#fff",
    fontWeight: "700",
  },
  error: {
    color: "#b91c1c",
    marginBottom: 8,
  },
  success: {
    color: "#166534",
    marginBottom: 8,
  },
  empty: {
    color: "#6b7280",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    maxHeight: "80%",
  },
  modalTitle: {
    fontWeight: "700",
    fontSize: 18,
    color: "#111827",
    marginBottom: 8,
  },
  previewBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  previewText: {
    fontFamily: "monospace",
    color: "#111827",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  closeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  closeBtnText: {
    color: "#374151",
    fontWeight: "700",
  },
});
