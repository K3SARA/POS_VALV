import React, { useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!username.trim() || !password) {
      setError("Username and password are required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await login(username.trim(), password);
    } catch (e) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.matteLayer}>
        <View style={styles.matteBlobA} />
        <View style={styles.matteBlobB} />
        <View style={styles.matteBlobC} />
      </View>

      <View style={styles.topBlock}>
        <Text style={styles.brandTitle}>Apex Logistics</Text>
        <Text style={styles.brandSub}>Fast, simple, reliable POS access</Text>
      </View>

      <View style={styles.formCard}>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#6b7280"
          secureTextEntry
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={onSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Login</Text>}
        </Pressable>
      </View>

      <View style={styles.logoCard}>
        <View style={styles.logoRow}>
        <Image source={require("../../assets/valvoline.png")} style={styles.partnerLogo} resizeMode="contain" />
        <View style={styles.logoDivider} />
        <Image source={require("../../assets/soft.png")} style={styles.partnerLogo} resizeMode="contain" />
        </View>
      </View>

      <Text style={styles.poweredBy}>
        Powered by{" "}
        <Text
          style={styles.poweredLink}
          onPress={() => Linking.openURL("https://jncosoftwaresolutions.pages.dev/")}
        >
          J&co.
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 54,
    paddingBottom: 24,
    backgroundColor: "#edf0f4",
  },
  matteLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  matteBlobA: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 220,
    top: -120,
    left: -90,
    backgroundColor: "rgba(42,95,209,0.09)",
  },
  matteBlobB: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 190,
    bottom: 140,
    right: -110,
    backgroundColor: "rgba(138,78,192,0.08)",
  },
  matteBlobC: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 140,
    bottom: -70,
    left: 40,
    backgroundColor: "rgba(0,140,190,0.07)",
  },
  topBlock: {
    flex: 0.88,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 2,
  },
  brandTitle: {
    fontSize: 46,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: 0.4,
  },
  brandSub: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "300",
    color: "#64748b",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5eaf2",
    shadowColor: "#0f172a",
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
    marginTop: -18,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 34,
    fontWeight: "700",
    marginBottom: 14,
    color: "#0f3152",
    letterSpacing: 0.1,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbe3ee",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: "300",
    color: "#0f172a",
  },
  button: {
    marginTop: 12,
    backgroundColor: "#2563eb",
    borderRadius: 999,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#315ed6",
    shadowColor: "#1d4ed8",
    shadowOpacity: 0.20,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "300",
    fontSize: 20,
    letterSpacing: 0.3,
  },
  error: {
    color: "#dc2626",
    marginTop: 4,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "300",
  },
  logoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e5eaf2",
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    width: "100%",
    paddingHorizontal: 12,
  },
  partnerLogo: {
    width: 128,
    height: 74,
  },
  logoDivider: {
    width: 1,
    height: 68,
    backgroundColor: "#cbd5e1",
    opacity: 1,
  },
  poweredBy: {
    textAlign: "center",
    color: "#475569",
    fontSize: 14,
    fontWeight: "300",
  },
  poweredLink: {
    color: "#2563eb",
    fontWeight: "400",
  },
});
