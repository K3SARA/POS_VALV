import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch } from "../api/client";
import { formatNumber } from "../utils/format";

function toReasonLabel(type) {
  if (type === "GOOD") return "Good";
  if (type === "DAMAGED_EXPIRED") return "Damaged/Expired";
  return "Other";
}

export default function ReturnsScreen() {
  const placeholderColor = "#6b7280";
  const [saleId, setSaleId] = useState("");
  const [sale, setSale] = useState(null);
  const [selected, setSelected] = useState({});
  const [reasonType, setReasonType] = useState("GOOD");
  const [customReason, setCustomReason] = useState("");
  const [returnsList, setReturnsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const saleItems = sale?.saleItems || [];

  const returnedByItem = useMemo(() => {
    const map = {};
    if (!sale?.id) return map;
    (returnsList || [])
      .filter((r) => Number(r.saleId) === Number(sale.id))
      .forEach((r) => {
        (r.items || []).forEach((it) => {
          const id = Number(it.saleItemId);
          if (!Number.isFinite(id)) return;
          const totalUnits = Number(it.qty || 0);
          const price = Number(it.price || 0);
          const paidUnits = price > 0 ? Number(it.lineTotal || 0) / price : totalUnits;
          const safePaid = Math.max(0, Math.min(totalUnits, paidUnits));
          const freeUnits = Math.max(0, totalUnits - safePaid);
          const prev = map[id] || { paid: 0, free: 0 };
          map[id] = { paid: prev.paid + safePaid, free: prev.free + freeUnits };
        });
      });
    return map;
  }, [returnsList, sale?.id]);

  function getLimits(si) {
    const returned = returnedByItem[si.id] || { paid: 0, free: 0 };
    return {
      paidRemaining: Math.max(0, Number(si.qty || 0) - Number(returned.paid || 0)),
      freeRemaining: Math.max(0, Number(si.freeQty || 0) - Number(returned.free || 0)),
    };
  }

  const totalRefund = useMemo(
    () =>
      saleItems.reduce((sum, si) => {
        const paid = Number(selected[si.id]?.qty || 0);
        return sum + paid * Number(si.price || 0);
      }, 0),
    [saleItems, selected]
  );

  async function loadSale() {
    const id = Number(String(saleId || "").trim());
    if (!id || id < 1) {
      setError("Enter a valid Sale ID");
      return;
    }
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const [saleData, returnsData] = await Promise.all([apiFetch(`/sales/${id}`), apiFetch("/returns")]);
      setSale(saleData);
      setReturnsList(Array.isArray(returnsData) ? returnsData : []);
      setSelected({});
      setMsg("Sale loaded");
    } catch (e) {
      setSale(null);
      setReturnsList([]);
      setError(e.message || "Failed to load sale");
    } finally {
      setLoading(false);
    }
  }

  function setQty(itemId, key, nextValue) {
    const n = Number(nextValue || 0);
    if (!Number.isFinite(n) || n < 0) return;
    const item = saleItems.find((x) => x.id === itemId);
    if (!item) return;
    const limits = getLimits(item);
    const max = key === "freeQty" ? limits.freeRemaining : limits.paidRemaining;
    const safe = Math.min(n, max);

    setSelected((prev) => {
      const current = prev[itemId] || { qty: 0, freeQty: 0 };
      const next = { ...prev, [itemId]: { ...current, [key]: safe } };
      if (!next[itemId].qty && !next[itemId].freeQty) delete next[itemId];
      return next;
    });
  }

  async function submitReturn() {
    if (!sale?.id) {
      setError("Load a sale first");
      return;
    }
    const reason =
      reasonType === "OTHER"
        ? String(customReason || "").trim()
        : reasonType;
    if (!reason) {
      setError("Reason is required");
      return;
    }

    const items = Object.entries(selected)
      .map(([saleItemId, v]) => ({
        saleItemId: Number(saleItemId),
        qty: Number(v?.qty || 0),
        freeQty: Number(v?.freeQty || 0),
      }))
      .filter((x) => x.qty > 0 || x.freeQty > 0);

    if (items.length === 0) {
      setError("Select at least one item");
      return;
    }

    setLoading(true);
    setError("");
    setMsg("");
    try {
      const res = await apiFetch("/returns", {
        method: "POST",
        body: JSON.stringify({
          saleId: sale.id,
          reason,
          returnType: reasonType,
          items,
        }),
      });
      setMsg(`Return saved. Refund: ${formatNumber(res?.totalRefund || totalRefund)}`);
      await loadSale();
    } catch (e) {
      setError(e.message || "Failed to save return");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 26 }}>
      <Text style={styles.heading}>Returns</Text>
      {loading ? <ActivityIndicator style={{ marginBottom: 8 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {msg ? <Text style={styles.success}>{msg}</Text> : null}

      <View style={styles.panel}>
        <Text style={styles.label}>Sale ID</Text>
        <TextInput
          style={styles.input}
          value={saleId}
          onChangeText={setSaleId}
          keyboardType="numeric"
          placeholder="Enter sale ID"
          placeholderTextColor={placeholderColor}
        />
        <Pressable style={styles.button} onPress={loadSale}>
          <Text style={styles.buttonText}>Load Bill</Text>
        </Pressable>
      </View>

      {sale ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Sale #{sale.id}</Text>
          <Text style={styles.meta}>Customer: {sale.customer?.name || sale.customerName || "-"}</Text>
          <Text style={styles.meta}>Date: {sale.createdAt ? new Date(sale.createdAt).toLocaleString() : "-"}</Text>

          {saleItems.map((si) => {
            const limits = getLimits(si);
            const paid = Number(selected[si.id]?.qty || 0);
            const free = Number(selected[si.id]?.freeQty || 0);
            return (
              <View key={String(si.id)} style={styles.itemCard}>
                <Text style={styles.itemName}>{si.product?.name || "Item"}</Text>
                <Text style={styles.meta}>Barcode: {si.product?.barcode || si.barcode || "-"}</Text>
                <Text style={styles.meta}>Sold Paid: {si.qty} | Sold Free: {si.freeQty || 0}</Text>
                <Text style={styles.meta}>Remaining Paid: {formatNumber(limits.paidRemaining)} | Remaining Free: {formatNumber(limits.freeRemaining)}</Text>
                <View style={styles.inline}>
                  <View style={styles.inputWrap}>
                    <Text style={styles.label}>Return Paid</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={paid ? String(paid) : ""}
                      onChangeText={(v) => setQty(si.id, "qty", v)}
                      placeholder="0"
                      placeholderTextColor={placeholderColor}
                    />
                  </View>
                  <View style={styles.inputWrap}>
                    <Text style={styles.label}>Return Free</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={free ? String(free) : ""}
                      onChangeText={(v) => setQty(si.id, "freeQty", v)}
                      placeholder="0"
                      placeholderTextColor={placeholderColor}
                    />
                  </View>
                </View>
              </View>
            );
          })}

          <Text style={[styles.label, { marginTop: 6 }]}>Reason</Text>
          <View style={styles.inline}>
            {["GOOD", "DAMAGED_EXPIRED", "OTHER"].map((type) => (
              <Pressable
                key={type}
                style={[styles.chip, reasonType === type && styles.chipActive]}
                onPress={() => setReasonType(type)}
              >
                <Text style={[styles.chipText, reasonType === type && styles.chipTextActive]}>{toReasonLabel(type)}</Text>
              </Pressable>
            ))}
          </View>
          {reasonType === "OTHER" ? (
            <TextInput
              style={styles.input}
              value={customReason}
              onChangeText={setCustomReason}
              placeholder="Type reason"
              placeholderTextColor={placeholderColor}
            />
          ) : null}

          <Text style={styles.total}>Refund Total: {formatNumber(totalRefund)}</Text>
          <Pressable style={styles.button} onPress={submitReturn}>
            <Text style={styles.buttonText}>Save Return</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
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
  panel: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  panelTitle: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  itemName: {
    color: "#111827",
    fontWeight: "700",
    marginBottom: 2,
  },
  label: {
    color: "#374151",
    fontWeight: "600",
    marginBottom: 4,
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
  inputWrap: {
    flex: 1,
    minWidth: 130,
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  button: {
    backgroundColor: "#1d4ed8",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  chip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  chipText: {
    color: "#374151",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },
  meta: {
    color: "#4b5563",
    marginBottom: 2,
  },
  total: {
    color: "#111827",
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 8,
  },
  error: {
    color: "#b91c1c",
    marginBottom: 8,
  },
  success: {
    color: "#166534",
    marginBottom: 8,
  },
});
