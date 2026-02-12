import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_API_URL = "http://localhost:4000";

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  DEFAULT_API_URL
).replace(/\/+$/, "");

export async function getToken() {
  return AsyncStorage.getItem("token");
}

export async function setSession(token, role) {
  if (token) {
    await AsyncStorage.setItem("token", token);
  } else {
    await AsyncStorage.removeItem("token");
  }

  if (role) {
    await AsyncStorage.setItem("role", role);
  } else {
    await AsyncStorage.removeItem("role");
  }
}

export async function getRole() {
  return AsyncStorage.getItem("role");
}

export async function clearSession() {
  await AsyncStorage.multiRemove(["token", "role"]);
}

export async function apiFetch(path, options = {}) {
  const token = await getToken();

  const headers = {
    ...(options.headers || {}),
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(payload?.error || "Request failed");
  }

  return payload;
}
