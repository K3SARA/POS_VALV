import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { apiFetch } from "../api/client";

function SaleCard({ sale }) {
  const totalItems = (sale.saleItems || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const customer = sale.customer?.name || "-";
  const paymentMethod = sale.paymentMethod || "cash";
  const billTotal = Number(sale.total || 0);
  const cashReceived = Number(sale.cashReceived ?? (paymentMethod === "credit" ? 0 : billTotal));
  const outstanding = Number(sale.outstanding ?? (paymentMethod === "credit" ? billTotal : 0));

  return (
    <View style={styles.card}>
      <Text style={styles.line}><Text style={styles.label}>Sale ID:</Text> {sale.id}</Text>
      <Text style={styles.line}><Text style={styles.label}>Date&time:</Text> {new Date(sale.createdAt).toLocaleString()}</Text>
      <Text style={styles.line}><Text style={styles.label}>Customer:</Text> {customer}</Text>
      <Text style={styles.line}><Text style={styles.label}>Payment:</Text> {paymentMethod}</Text>
      <Text style={styles.line}><Text style={styles.label}>Items:</Text> {totalItems}</Text>
      <Text style={styles.line}><Text style={styles.label}>Bill total:</Text> {Math.round(billTotal)}</Text>
      <Text style={styles.line}><Text style={styles.label}>Cash received:</Text> {Math.round(cashReceived)}</Text>
      <Text style={styles.line}><Text style={styles.label}>Outstanding:</Text> {Math.round(outstanding)}</Text>
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

  const sortedSales = useMemo(
    () => [...sales].sort((a, b) => Number(b.id || 0) - Number(a.id || 0)),
    [sales]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Sales History</Text>
      <Text style={styles.subhead}>Sale ID | Date&time | Customer | Payment | Items | Bill total | Cash received | Outstanding</Text>
      {loading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={sortedSales}
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
    marginBottom: 4,
  },
  subhead: {
    color: "#4b5563",
    marginBottom: 10,
    fontSize: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 8,
  },
  line: {
    color: "#374151",
    marginBottom: 2,
  },
  label: {
    color: "#111827",
    fontWeight: "700",
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
