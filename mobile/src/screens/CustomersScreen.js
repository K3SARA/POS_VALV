import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch } from "../api/client";

const OUT_PREFIX = "OUTSTANDING:";

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

export default function CustomersScreen() {
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/customers");
      setCustomers(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCustomers();
    setRefreshing(false);
  }, [loadCustomers]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      .map((c) => ({ ...c, outstanding: parseOutstanding(c.notes) }))
      .filter((c) => {
        if (!q) return true;
        const name = String(c.name || "").toLowerCase();
        const phone = String(c.phone || "").toLowerCase();
        const address = String(c.address || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || address.includes(q);
      })
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [customers, query]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Customers</Text>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Search customer"
      />
      {loading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.topLine}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={[styles.outstanding, item.outstanding > 0 ? styles.outstandingWarn : null]}>
                Outstanding: {Math.round(item.outstanding)}
              </Text>
            </View>
            <Text style={styles.meta}>Phone: {item.phone || "-"}</Text>
            <Text style={styles.meta}>Address: {item.address || "-"}</Text>
            <Text style={styles.meta}>Created: {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</Text>
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No customers found</Text> : null}
      />

      <Pressable style={styles.button} onPress={loadCustomers}>
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
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  error: {
    color: "#b91c1c",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 8,
  },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  name: {
    fontWeight: "700",
    color: "#111827",
  },
  outstanding: {
    color: "#1f2937",
    fontWeight: "700",
  },
  outstandingWarn: {
    color: "#b91c1c",
  },
  meta: {
    color: "#374151",
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
