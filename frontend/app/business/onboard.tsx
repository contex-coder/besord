import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { colors } from "@/src/theme";

/**
 * Legacy /business/onboard route — replaced by unified /workspaces flow.
 * Redirects users to the workspaces screen in "create new" mode.
 */
export default function BusinessOnboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/workspaces?new=1");
  }, [router]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.text} />
    </View>
  );
}
