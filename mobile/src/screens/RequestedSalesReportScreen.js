import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiFetch } from "../api/client";
import { formatNumber } from "../utils/format";

const Row = React.memo(function Row({ item }) {
  return (
    <View style={styles.card}>
      <Text style={styles.line}><Text style={styles.label}>Request ID:</Text> #{item.id}</Text>
      <Text style={styles.line}><Text style={styles.label}>Status:</Text> {item.status}</Text>
      <Text style={styles.line}><Text style={styles.label}>Customer:</Text> {item.customerName}</Text>
      <Text style={styles.line}><Text style={styles.label}>Requested by:</Text> {item.requestedBy}</Text>
      <Text style={styles.line}><Text style={styles.label}>Payment:</Text> {item.paymentMethod}</Text>
      <Text style={styles.line}><Text style={styles.label}>Items:</Text> {formatNumber(item.itemCount)}</Text>
      <Text style={styles.line}><Text style={styles.label}>Updated:</Text> {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-"}</Text>
    </View>
  );
});

export default function RequestedSalesReportScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadRows = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/pending-sales");
      const list = Array.isArray(data) ? data : [];
      const mapped = list.map((r) => {
        const pending = r?.pending || {};
        const payload = pending?.payload || {};
        const items = Array.isArray(payload?.items) ? payload.items : [];
        return {
          id: r?.id,
          status: String(pending?.status || "pending"),
          customerName: payload?.customer?.name || "-",
          requestedBy: pending?.requestedBy?.username || "-",
          paymentMethod: String(payload?.paymentMethod || "cash"),
          itemCount: items.reduce((sum, it) => sum + Number(it?.qty || 0) + Number(it?.freeQty || 0), 0),
          updatedAt: r?.updatedAt || pending?.updatedAt || r?.createdAt || pending?.createdAt || null,
        };
      });
      mapped.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      setRows(mapped);
    } catch (e) {
      setError(e.message || "Failed to load requested sales");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadRows();
  }, [loadRows]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRows();
    setRefreshing(false);
  }, [loadRows]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.total += 1;
        acc.items += Number(r.itemCount || 0);
        if (r.status === "pending") acc.pending += 1;
        if (r.status === "approved") acc.approved += 1;
        if (r.status === "rejected" || r.status === "deleted") acc.rejected += 1;
        return acc;
      },
      { total: 0, items: 0, pending: 0, approved: 0, rejected: 0 }
    );
  }, [rows]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Requested Sales Report</Text>
      <Text style={styles.subhead}>Pending-sales request summary and history</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLine}>Total requests: {formatNumber(totals.total)}</Text>
        <Text style={styles.summaryLine}>Total items: {formatNumber(totals.items)}</Text>
        <Text style={styles.summaryLine}>Pending: {formatNumber(totals.pending)}</Text>
        <Text style={styles.summaryLine}>Approved: {formatNumber(totals.approved)}</Text>
        <Text style={styles.summaryLine}>Rejected/Deleted: {formatNumber(totals.rejected)}</Text>
      </View>

      {loading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <Row item={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No requested sales found</Text> : null}
      />

      <Pressable style={styles.button} onPress={loadRows}>
        <Text style={styles.buttonText}>Reload</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 14,
    backgroundColor: "#f5f7fb",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  subhead: {
    color: "#4b5563",
    marginBottom: 10,
    fontSize: 12,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    marginBottom: 10,
  },
  summaryLine: {
    color: "#111827",
    fontWeight: "600",
    marginBottom: 2,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 10,
  },
  line: {
    color: "#111827",
    marginBottom: 2,
  },
  label: {
    fontWeight: "700",
    color: "#374151",
  },
  error: {
    color: "#b91c1c",
    marginBottom: 8,
  },
  empty: {
    color: "#6b7280",
    textAlign: "center",
    marginTop: 30,
  },
  button: {
    marginTop: 8,
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
