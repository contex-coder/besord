





import React from "react";
import { Dimensions, Platform } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const IS_SMALL = SCREEN_W < 380;
const IS_IOS = Platform.OS === "ios";







































































export default function TabsLayout() {
  return (

    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: 4,
          borderTopColor: colors.border,



          height: IS_SMALL ? 56 : IS_IOS ? 78 : 64,
          paddingBottom: IS_SMALL ? 4 : IS_IOS ? 20 : 6,
          paddingTop: IS_SMALL ? 4 : 6,
        },
        tabBarLabelStyle: {
          fontWeight: "900",

          fontSize: IS_SMALL ? 8 : 10,
          letterSpacing: 1.2,
        },
        tabBarIconStyle: {
          marginTop: IS_SMALL ? -2 : 0,
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "FEED",
          tabBarIcon: ({ color, size }) => (

            <Ionicons name="home" size={IS_SMALL ? size * 0.8 : size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="criar"
        options={{
          title: "CRIAR",
          tabBarIcon: ({ color, size }) => (

            <Ionicons name="add-circle" size={IS_SMALL ? size * 0.8 : size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "PERFIL",
          tabBarIcon: ({ color, size }) => (

            <Ionicons name="person" size={IS_SMALL ? size * 0.8 : size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}





















