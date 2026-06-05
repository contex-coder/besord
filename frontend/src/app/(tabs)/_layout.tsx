import React, { useEffect, Component, ErrorInfo, ReactNode } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Text, View, ScrollView } from "react-native";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/contexts/AuthContext";

// --- 1. DETECTOR GLOBAL VIA DOM (IGNORA BLOQUEIO DE POP-UP) ---
if (typeof window !== 'undefined') {
  const createErrorOverlay = (title: string, message: string, stack?: string) => {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.width = '100%';
    div.style.background = '#1e1b4b';
    div.style.color = '#f43f5e';
    div.style.padding = '20px';
    div.style.zIndex = '999999';
    div.style.fontFamily = 'monospace';
    div.style.fontSize = '14px';
    div.style.whiteSpace = 'pre-wrap';
    div.style.borderBottom = '5px solid #f43f5e';
    div.innerHTML = `<b>🚨 ${title}:</b> ${message}<br/><br/><b>Stack:</b> ${stack || 'Não disponível'}`;
    document.body.appendChild(div);
  };

  window.addEventListener('error', (event) => {
    createErrorOverlay("ERRO GLOBAL DE COMPILAÇÃO", event.message, event.error?.stack);
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    createErrorOverlay("PROMESSA QUEBRADA (API/AUTH)", String(event.reason));
  });
}

// --- 2. PAINEL DE ERROS INTERNOS DO REACT ---
interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null; }

class DiagnosticErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null, errorInfo: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <ScrollView style={{ backgroundColor: "#7f1d1d", padding: 25, flex: 1 }}>
          <Text style={{ color: "#fca5a5", fontSize: 22, fontWeight: "bold", marginBottom: 15, marginTop: 40 }}>
            🚨 Erro de Renderização Interno (React)
          </Text>
          <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "bold", marginBottom: 15, backgroundColor: "#991b1b", padding: 10 }}>
            {this.state.error?.toString()}
          </Text>
          <Text style={{ color: "#cbd5e1", fontSize: 12, fontFamily: "monospace" }}>
            {this.state.errorInfo?.componentStack}
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

// Mantém a tela de carregamento visível até as fontes carregarem
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }} />
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <DiagnosticErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </DiagnosticErrorBoundary>
  );
}