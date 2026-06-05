import { useAuth } from "@/s../../contexts/AuthContext";
import { Redirect } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";

export default function AuthCallback() {
  const { token } = useAuth();

  useEffect(() => {
    // The AuthProvider will handle the token from the URL and redirect.
  }, []);

  if (token) {
    return <Redirect href="/" />;
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Finalizando login...</Text>
    </View>
  );
}
