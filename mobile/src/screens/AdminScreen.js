import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { apiFetch } from "../api/client";

function Metric({ label, value }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export default function AdminScreen() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryData, usersData] = await Promise.all([
        apiFetch("/reports/summary"),
        apiFetch("/users"),
      ]);
      setSummary(summaryData);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (e) {
      setError(e.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 16 }}>
      <Text style={styles.heading}>Admin Dashboard</Text>
      {loading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.metricsGrid}>
        <Metric label="Total Products" value={summary?.totalProducts ?? "-"} />
        <Metric label="Low Stock" value={summary?.lowStock ?? "-"} />
        <Metric label="Today Bills" value={summary?.todayBills ?? "-"} />
        <Metric label="Today Revenue" value={Math.round(Number(summary?.todayRevenue || 0))} />
        <Metric label="Users" value={summary?.totalUsers ?? "-"} />
      </View>

      <Text style={styles.sectionTitle}>Users</Text>
      <FlatList
        data={users}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <Text style={styles.userName}>{item.username}</Text>
            <Text style={styles.userMeta}>Role: {item.role}</Text>
            <Text style={styles.userMeta}>
              Created: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}
            </Text>
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No users found</Text> : null}
      />

      <Pressable style={styles.button} onPress={loadAdminData}>
        <Text style={styles.buttonText}>Reload</Text>
      </Pressable>
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
  error: {
    color: "#b91c1c",
    marginBottom: 8,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  userCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  userName: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  userMeta: {
    color: "#374151",
  },
  empty: {
    color: "#6b7280",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
