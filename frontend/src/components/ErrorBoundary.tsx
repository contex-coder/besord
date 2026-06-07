import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors } from "@/src/theme";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚡</Text>
          <Text style={styles.title}>ALGO CORREU MAL</Text>
          <Text style={styles.sub}>Mas não te preocupes, já estamos a tratar disso.</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => {
              this.setState({ hasError: false, error: null });
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
          >
            <Text style={styles.btnText}>TENTAR NOVAMENTE</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 10,
  },
  emoji: { fontSize: 64 },
  title: { fontSize: 22, fontWeight: "900", color: colors.text, textAlign: "center" },
  sub: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
  btn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: colors.neutral,
    borderWidth: 3,
    borderColor: colors.border,
  },
  btnText: { fontSize: 13, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
});
