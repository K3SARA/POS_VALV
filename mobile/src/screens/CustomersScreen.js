import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { formatNumber } from "../utils/format";

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

function getCustomerOutstanding(customer, outstandingMap) {
  return Math.max(
    Number(outstandingMap[customer.id] || 0),
    parseOutstanding(customer.notes)
  );
}

const CustomerCard = React.memo(function CustomerCard({ item, outstanding }) {
  return (
    <View style={styles.card}>
      <View style={styles.topLine}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={[styles.outstanding, outstanding > 0 ? styles.outstandingWarn : null]}>
          Outstanding: {formatNumber(outstanding)}
        </Text>
      </View>
      <Text style={styles.meta}>Phone: {item.phone || "-"}</Text>
      <Text style={styles.meta}>Address: {item.address || "-"}</Text>
      <Text style={styles.meta}>Created: {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</Text>
    </View>
  );
});

export default function CustomersScreen() {
  useAuth();
  const placeholderColor = "#6b7280";
  const [customers, setCustomers] = useState([]);
  const [outstandingMap, setOutstandingMap] = useState({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [sortBy, setSortBy] = useState("highest_outstanding");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const [data, outstanding] = await Promise.all([
        apiFetch("/customers"),
        apiFetch("/reports/customer-outstanding"),
      ]);

      setCustomers(Array.isArray(data) ? data : []);
      const map = {};
      (outstanding?.rows || []).forEach((row) => {
        if (row?.customerId) {
          map[row.customerId] = Number(row.outstanding || 0);
        }
      });
      setOutstandingMap(map);
    } catch (e) {
      setError(e.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  function resetCustomerForm() {
    setNameInput("");
    setPhoneInput("");
    setAddressInput("");
  }

  async function onAddCustomer() {
    const name = String(nameInput || "").trim();
    if (!name) {
      setError("Customer name is required");
      return;
    }
    const phoneDigits = String(phoneInput || "").replace(/\D/g, "");
    if (!phoneDigits) {
      setError("Phone is required");
      return;
    }
    if (phoneDigits.length !== 10) {
      setError("Phone must be exactly 10 digits");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMessage("");
      await apiFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone: phoneDigits,
          address: addressInput ? String(addressInput).trim() : null,
        }),
      });
      setMessage("Customer added");
      setShowAddModal(false);
      resetCustomerForm();
      await loadCustomers();
    } catch (e) {
      setError(e.message || "Failed to add customer");
    } finally {
      setLoading(false);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCustomers();
    setRefreshing(false);
  }, [loadCustomers]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...customers]
      .filter((c) => {
        if (!q) return true;
        const name = String(c.name || "").toLowerCase();
        const phone = String(c.phone || "").toLowerCase();
        const address = String(c.address || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || address.includes(q);
      });

    if (sortBy === "highest_outstanding") {
      list.sort((a, b) => getCustomerOutstanding(b, outstandingMap) - getCustomerOutstanding(a, outstandingMap));
    } else if (sortBy === "lowest_outstanding") {
      list.sort((a, b) => getCustomerOutstanding(a, outstandingMap) - getCustomerOutstanding(b, outstandingMap));
    } else if (sortBy === "name_asc") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    } else if (sortBy === "name_desc") {
      list.sort((a, b) => String(b.name || "").localeCompare(String(a.name || "")));
    } else if (sortBy === "latest") {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sortBy === "oldest") {
      list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    }

    return list;
  }, [customers, outstandingMap, query, sortBy]);

  const keyExtractor = useCallback((item) => String(item.id), []);
  const renderCustomerItem = useCallback(
    ({ item }) => (
      <CustomerCard item={item} outstanding={getCustomerOutstanding(item, outstandingMap)} />
    ),
    [outstandingMap]
  );

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Customers</Text>
        <Pressable style={styles.topAddButton} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addButtonText}>Add Customer</Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Search customer"
        placeholderTextColor={placeholderColor}
      />
      <Text style={styles.filterLabel}>Sort by</Text>
      <View style={styles.sortRow}>
        {[
          { key: "highest_outstanding", label: "Highest Outstanding" },
          { key: "lowest_outstanding", label: "Lowest Outstanding" },
          { key: "latest", label: "Latest" },
          { key: "oldest", label: "Oldest" },
          { key: "name_asc", label: "Name A-Z" },
          { key: "name_desc", label: "Name Z-A" },
        ].map((opt) => (
          <Pressable
            key={opt.key}
            style={[styles.sortChip, sortBy === opt.key && styles.sortChipActive]}
            onPress={() => setSortBy(opt.key)}
          >
            <Text style={[styles.sortChipText, sortBy === opt.key && styles.sortChipTextActive]}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <FlatList
        data={visible}
        keyExtractor={keyExtractor}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={renderCustomerItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No customers found</Text> : null}
      />

      <Pressable style={styles.button} onPress={loadCustomers}>
        <Text style={styles.buttonText}>Reload</Text>
      </Pressable>

      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Customer</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <TextInput
                style={styles.input}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Name *"
                placeholderTextColor={placeholderColor}
              />
              <TextInput
                style={styles.input}
                value={phoneInput}
                onChangeText={(v) => setPhoneInput(String(v || "").replace(/\D/g, "").slice(0, 10))}
                placeholder="Phone *"
                placeholderTextColor={placeholderColor}
                keyboardType="numeric"
                maxLength={10}
              />
              <TextInput
                style={styles.input}
                value={addressInput}
                onChangeText={setAddressInput}
                placeholder="Address"
                placeholderTextColor={placeholderColor}
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.addButton} onPress={onAddCustomer}>
                <Text style={styles.addButtonText}>Save</Text>
              </Pressable>
              <Pressable
                style={[styles.addButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddModal(false);
                  resetCustomerForm();
                }}
              >
                <Text style={styles.addButtonText}>Cancel</Text>
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
    padding: 14,
    backgroundColor: "#f5f7fb",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  input: {
    backgroundColor: "#fff",
    color: "#111827",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  sortChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  sortChipActive: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  sortChipText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 12,
  },
  sortChipTextActive: {
    color: "#fff",
  },
  filterLabel: {
    color: "#4b5563",
    marginBottom: 4,
    fontSize: 12,
  },
  dateInputBtn: {
    backgroundColor: "#fff",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInputText: {
    color: "#111827",
    fontWeight: "600",
  },
  error: {
    color: "#b91c1c",
    marginBottom: 8,
  },
  success: {
    color: "#166534",
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
    flex: 1,
  },
  topAddButton: {
    alignSelf: "flex-start",
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "700",
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
  },
  modalTitle: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  cancelButton: {
    backgroundColor: "#6b7280",
  },
});
