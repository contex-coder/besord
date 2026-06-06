
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors } from '@/src/theme';

export default function AuthCallback() {
  const { loading, user, handleToken } = useAuth();
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  useEffect(() => {
    if (token) {
      console.log("AuthCallback: Token detectado na URL, processando...", token);
      handleToken(token).then(() => {
        // Após processar, limpa a URL para evitar re-processamento
        router.replace('/(tabs)/feed');
      });
    }
  }, [token, handleToken]);

  // Se o AuthContext já tem um usuário (ou terminou de processar),
  // redirecionamos para o feed.
  if (user) {
    return <Redirect href="/(tabs)/feed" />;
  }

  // Se não tem token e não está carregando, algo deu errado (voltar para home)
  if (!token && !loading) {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
