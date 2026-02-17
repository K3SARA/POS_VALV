import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { formatNumber } from "../utils/format";

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const ProductCard = React.memo(function ProductCard({ item }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.meta}>Barcode: {item.barcode}</Text>
      <Text style={styles.meta}>Price: {formatNumber(item.price || 0)}</Text>
      <Text style={styles.meta}>Stock: {formatNumber(item.stock || 0)}</Text>
    </View>
  );
});

export default function ProductsScreen() {
  const { role } = useAuth();
  const placeholderColor = "#6b7280";
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [returnsList, setReturnsList] = useState([]);
  const [returnsTypeView, setReturnsTypeView] = useState("");
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [invoicePrice, setInvoicePrice] = useState("");
  const [stock, setStock] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [supplierPaymentMethod, setSupplierPaymentMethod] = useState("");
  const [receivedDate, setReceivedDate] = useState(new Date());
  const [showReceivedDatePicker, setShowReceivedDatePicker] = useState(false);
  const [invoicePhoto, setInvoicePhoto] = useState("");

  const loadProducts = useCallback(async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const [productsData, returnsData] = await Promise.all([
        apiFetch("/products"),
        apiFetch("/returns"),
      ]);
      const list = Array.isArray(productsData) ? productsData : productsData?.items || [];
      setProducts(list);
      setReturnsList(Array.isArray(returnsData) ? returnsData : []);
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

  const classifyReturnType = useCallback((r) => {
    const t = String(r?.returnType || "").toUpperCase();
    if (t === "GOOD" || t === "DAMAGED_EXPIRED" || t === "OTHER") return t;
    const reason = String(r?.reason || "").toUpperCase();
    if (reason.includes("DAMAGED") || reason.includes("DAMAGE") || reason.includes("EXPIRE")) return "DAMAGED_EXPIRED";
    if (reason.includes("GOOD")) return "GOOD";
    return "OTHER";
  }, []);

  const returnRowsByType = useMemo(() => {
    if (!returnsTypeView) return [];
    const map = new Map();
    for (const ret of returnsList) {
      if (classifyReturnType(ret) !== returnsTypeView) continue;
      for (const item of ret.items || []) {
        const key = String(item.productId || item.product?.id || item.product?.barcode || item.saleItemId);
        const prev = map.get(key) || {
          name: item.product?.name || "Item",
          barcode: item.product?.barcode || "-",
          qty: 0,
        };
        prev.qty += Number(item.qty || 0);
        map.set(key, prev);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [returnsList, returnsTypeView, classifyReturnType]);

  const returnCounts = useMemo(() => {
    const counts = { GOOD: 0, DAMAGED_EXPIRED: 0, OTHER: 0 };
    for (const r of returnsList) {
      const type = classifyReturnType(r);
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }, [returnsList, classifyReturnType]);

  const keyExtractor = useCallback((item) => String(item.id || item.barcode), []);
  const renderProductItem = useCallback(({ item }) => <ProductCard item={item} />, []);

  React.useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function resetProductForm() {
    setBarcode("");
    setName("");
    setPrice("");
    setInvoicePrice("");
    setStock("");
    setSupplierName("");
    setSupplierInvoiceNo("");
    setSupplierPaymentMethod("");
    setReceivedDate(new Date());
    setInvoicePhoto("");
  }

  async function onAddProduct() {
    const safeBarcode = String(barcode || "").trim();
    const safeName = String(name || "").trim();
    if (!safeBarcode || !safeName) {
      setError("Barcode and name are required");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMessage("");
      await apiFetch("/products", {
        method: "POST",
        body: JSON.stringify({
          barcode: safeBarcode,
          name: safeName,
          price: Number(price || 0),
          invoicePrice: invoicePrice !== "" ? Number(invoicePrice || 0) : null,
          stock: Number(stock || 0),
          supplierName: supplierName ? String(supplierName).trim() : null,
          supplierInvoiceNo: supplierInvoiceNo ? String(supplierInvoiceNo).trim() : null,
          supplierPaymentMethod: supplierPaymentMethod ? String(supplierPaymentMethod).trim() : null,
          receivedDate: receivedDate ? formatDateInput(receivedDate) : null,
          invoicePhoto: invoicePhoto ? String(invoicePhoto).trim() : null,
        }),
      });
      setMessage("Product added");
      setShowAddModal(false);
      resetProductForm();
      await loadProducts();
    } catch (e) {
      setError(e.message || "Failed to add product");
    } finally {
      setLoading(false);
    }
  }

  function onReceivedDateChange(event, selected) {
    if (Platform.OS === "android") setShowReceivedDatePicker(false);
    if (selected) setReceivedDate(selected);
  }

  async function pickInvoicePhotoFromCamera() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError("Camera permission is required");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled) return;
      const base64 = result.assets?.[0]?.base64 || "";
      const uri = result.assets?.[0]?.uri || "";
      if (base64) {
        setInvoicePhoto(`data:image/jpeg;base64,${base64}`);
      } else if (uri) {
        // Fallback if base64 is unavailable on some devices.
        setInvoicePhoto(uri);
      }
    } catch (e) {
      setError("Failed to open camera");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Products</Text>
      <View style={styles.topActions}>
        {role === "admin" ? (
          <Pressable style={[styles.addButton, styles.topButton]} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addButtonText}>Add Product</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.refreshButton} onPress={loadProducts} disabled={loading}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>
        <Pressable style={styles.returnBtn} onPress={() => setReturnsTypeView("GOOD")}>
          <Text style={styles.returnBtnText}>Good Returns ({returnCounts.GOOD || 0})</Text>
        </Pressable>
        <Pressable style={styles.returnBtn} onPress={() => setReturnsTypeView("DAMAGED_EXPIRED")}>
          <Text style={styles.returnBtnText}>Damaged/Expired ({returnCounts.DAMAGED_EXPIRED || 0})</Text>
        </Pressable>
        <Pressable style={styles.returnBtn} onPress={() => setReturnsTypeView("OTHER")}>
          <Text style={styles.returnBtnText}>Others ({returnCounts.OTHER || 0})</Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or barcode"
        placeholderTextColor={placeholderColor}
      />

      {loading ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <FlatList
        data={visibleProducts}
        keyExtractor={keyExtractor}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={renderProductItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No products found</Text> : null}
      />

      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Product</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.fieldLabel}>Barcode</Text>
              <TextInput style={styles.input} value={barcode} onChangeText={setBarcode} placeholder="Barcode *" placeholderTextColor={placeholderColor} />
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name *" placeholderTextColor={placeholderColor} />
              <Text style={styles.fieldLabel}>Price</Text>
              <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="Price" keyboardType="numeric" placeholderTextColor={placeholderColor} />
              <Text style={styles.fieldLabel}>Invoice Price</Text>
              <TextInput
                style={styles.input}
                value={invoicePrice}
                onChangeText={setInvoicePrice}
                placeholder="Invoice Price"
                keyboardType="numeric"
                placeholderTextColor={placeholderColor}
              />
              <Text style={styles.fieldLabel}>Stock</Text>
              <TextInput style={styles.input} value={stock} onChangeText={setStock} placeholder="Stock" keyboardType="numeric" placeholderTextColor={placeholderColor} />
              <Text style={styles.fieldLabel}>Supplier Name</Text>
              <TextInput style={styles.input} value={supplierName} onChangeText={setSupplierName} placeholder="Supplier Name" placeholderTextColor={placeholderColor} />
              <Text style={styles.fieldLabel}>Supplier Invoice No</Text>
              <TextInput style={styles.input} value={supplierInvoiceNo} onChangeText={setSupplierInvoiceNo} placeholder="Supplier Invoice No" placeholderTextColor={placeholderColor} />
              <Text style={styles.filterLabel}>Supplier Payment Method</Text>
              <View style={styles.methodRow}>
                {["cash", "credit", "cheque"].map((method) => (
                  <Pressable
                    key={method}
                    style={[
                      styles.methodChip,
                      supplierPaymentMethod === method && styles.methodChipActive,
                    ]}
                    onPress={() => setSupplierPaymentMethod(method)}
                  >
                    <Text
                      style={[
                        styles.methodText,
                        supplierPaymentMethod === method && styles.methodTextActive,
                      ]}
                    >
                      {method}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.filterLabel}>Received Date</Text>
              <Pressable style={styles.dateInputBtn} onPress={() => setShowReceivedDatePicker(true)}>
                <Text style={styles.dateInputText}>{formatDateInput(receivedDate)}</Text>
              </Pressable>
              {showReceivedDatePicker ? (
                <DateTimePicker
                  value={receivedDate}
                  mode="date"
                  display="default"
                  onChange={onReceivedDateChange}
                />
              ) : null}
              <View style={styles.cameraRow}>
                <Pressable style={styles.cameraBtn} onPress={pickInvoicePhotoFromCamera}>
                  <Ionicons name="camera-outline" size={18} color="#ffffff" />
                  <Text style={styles.cameraBtnText}>Add Invoice Photo</Text>
                </Pressable>
              </View>
              {invoicePhoto ? <Text style={styles.photoText}>Photo: Captured</Text> : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={[styles.addButton, styles.modalActionButton]} onPress={onAddProduct}>
                <Text style={styles.addButtonText}>Save</Text>
              </Pressable>
              <Pressable
                style={[styles.addButton, styles.modalActionButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddModal(false);
                  resetProductForm();
                }}
              >
                <Text style={styles.addButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(returnsTypeView)} transparent animationType="fade" onRequestClose={() => setReturnsTypeView("")}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {returnsTypeView === "GOOD" ? "Good Returns" : returnsTypeView === "DAMAGED_EXPIRED" ? "Damaged/Expired Returns" : "Other Returns"}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {returnRowsByType.map((row) => (
                <View key={`${row.barcode}-${row.name}`} style={styles.card}>
                  <Text style={styles.name}>{row.name}</Text>
                  <Text style={styles.meta}>Barcode: {row.barcode}</Text>
                  <Text style={styles.meta}>Returned Qty: {formatNumber(row.qty || 0)}</Text>
                </View>
              ))}
              {returnRowsByType.length === 0 ? <Text style={styles.empty}>No returns for this type</Text> : null}
            </ScrollView>
            <Pressable style={[styles.addButton, { marginTop: 8 }]} onPress={() => setReturnsTypeView("")}>
              <Text style={styles.addButtonText}>Close</Text>
            </Pressable>
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
  input: {
    backgroundColor: "#fff",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    color: "#111827",
  },
  fieldLabel: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
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
    marginBottom: 10,
  },
  dateInputText: {
    color: "#111827",
    fontWeight: "600",
  },
  methodRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  methodChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
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
  cameraRow: {
    marginBottom: 10,
  },
  cameraBtn: {
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  cameraBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  photoText: {
    color: "#166534",
    fontWeight: "600",
    marginBottom: 10,
  },
  success: {
    color: "#166534",
    marginBottom: 8,
  },
  topActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  returnBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  returnBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  topButton: {
    marginBottom: 0,
    flex: 1,
  },
  addButton: {
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  refreshButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonText: {
    color: "#fff",
    fontWeight: "700",
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
  modalActionButton: {
    flex: 1,
  },
  cancelButton: {
    backgroundColor: "#6b7280",
    flex: 1,
  },
});
