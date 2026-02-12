import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch } from "../api/client";

export default function ProductsScreen() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadProducts = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/products");
      const list = Array.isArray(data) ? data : data?.items || [];
      setProducts(list);
    } catch (e) {
      setError(e.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  }, [loadProducts]);

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((item) => {
      const name = String(item.name || "").toLowerCase();
      const barcode = String(item.barcode || "").toLowerCase();
      return name.includes(q) || barcode.includes(q);
    });
  }, [products, query]);

  React.useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Products</Text>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or barcode"
      />

      {loading ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={visibleProducts}
        keyExtractor={(item) => String(item.id || item.barcode)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>Barcode: {item.barcode}</Text>
            <Text style={styles.meta}>Price: {Number(item.price || 0)}</Text>
            <Text style={styles.meta}>Stock: {Number(item.stock || 0)}</Text>
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No products found</Text> : null}
      />

      <Pressable style={styles.reloadButton} onPress={loadProducts}>
        <Text style={styles.reloadText}>Reload</Text>
      </Pressable>
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
  input: {
    backgroundColor: "#fff",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 8,
  },
  name: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  meta: {
    color: "#374151",
  },
  empty: {
    textAlign: "center",
    marginTop: 16,
    color: "#6b7280",
  },
  error: {
    color: "#b91c1c",
    marginBottom: 8,
  },
  reloadButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },
  reloadText: {
    color: "#fff",
    fontWeight: "700",
  },
});
