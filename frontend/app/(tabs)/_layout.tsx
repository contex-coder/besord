import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";

import { colors } from "@/src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: "#A1A1AA",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 6 },
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: 4,
          borderTopColor: colors.border,
          height: 78,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "FEED",
          tabBarButtonTestID: "nav-tab-feed",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="grid" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="criar"
        options={{
          title: "CRIAR",
          tabBarButtonTestID: "nav-tab-criar",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="add-circle" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "PERFIL",
          tabBarButtonTestID: "nav-tab-perfil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color, focused }: { name: any; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} size={24} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: { padding: 4 },
  iconWrapActive: { borderBottomWidth: 4, borderBottomColor: colors.aprovo },
});
