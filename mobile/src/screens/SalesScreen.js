import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { apiFetch } from "../api/client";

function SaleCard({ sale }) {
  const totalItems = (sale.saleItems || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const customer = sale.customer?.name || "-";

  return (
    <View style={styles.card}>
      <Text style={styles.id}>Sale #{sale.id}</Text>
      <Text style={styles.meta}>Date: {new Date(sale.createdAt).toLocaleString()}</Text>
      <Text style={styles.meta}>Customer: {customer}</Text>
      <Text style={styles.meta}>Payment: {sale.paymentMethod || "cash"}</Text>
      <Text style={styles.meta}>Items: {totalItems}</Text>
      <Text style={styles.total}>Total: {Math.round(Number(sale.total || 0))}</Text>
    </View>
  );
}

export default function SalesScreen() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadSales = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/sales");
      setSales(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load sales");
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSales();
    setRefreshing(false);
  }, [loadSales]);

  React.useEffect(() => {
    loadSales();
  }, [loadSales]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Sales History</Text>
      {loading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={sales}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => <SaleCard sale={item} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No sales yet</Text> : null}
      />

      <Pressable style={styles.button} onPress={loadSales}>
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
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 8,
  },
  id: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  meta: {
    color: "#374151",
  },
  total: {
    marginTop: 6,
    fontWeight: "700",
    color: "#111827",
  },
  error: {
    color: "#b91c1c",
    marginBottom: 8,
  },
  empty: {
    textAlign: "center",
    marginTop: 16,
    color: "#6b7280",
  },
  button: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
