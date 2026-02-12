import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import CashierScreen from "./src/screens/CashierScreen";
import ProductsScreen from "./src/screens/ProductsScreen";
import SalesScreen from "./src/screens/SalesScreen";
import AdminScreen from "./src/screens/AdminScreen";

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HeaderRightLogout() {
  const { logout } = useAuth();

  return (
    <Pressable onPress={logout} style={styles.logoutBtn}>
      <Text style={styles.logoutText}>Logout</Text>
    </Pressable>
  );
}

function CashierTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerRight: () => <HeaderRightLogout />,
        tabBarActiveTintColor: "#1d4ed8",
      }}
    >
      <Tabs.Screen name="Cashier" component={CashierScreen} />
      <Tabs.Screen name="Products" component={ProductsScreen} />
      <Tabs.Screen name="Sales" component={SalesScreen} />
    </Tabs.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerRight: () => <HeaderRightLogout />,
        tabBarActiveTintColor: "#1d4ed8",
      }}
    >
      <Tabs.Screen name="Admin" component={AdminScreen} />
      <Tabs.Screen name="Cashier" component={CashierScreen} />
      <Tabs.Screen name="Products" component={ProductsScreen} />
      <Tabs.Screen name="Sales" component={SalesScreen} />
    </Tabs.Navigator>
  );
}

function RootNavigator() {
  const { isAuthed, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <Text style={styles.loaderText}>Loading session...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthed ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : role === "admin" ? (
        <Stack.Screen name="AdminTabs" component={AdminTabs} />
      ) : (
        <Stack.Screen name="CashierTabs" component={CashierTabs} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  logoutBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#111827",
  },
  logoutText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f7fb",
  },
  loaderText: {
    color: "#374151",
    fontSize: 16,
  },
});
