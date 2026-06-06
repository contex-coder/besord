
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors } from '@/src/theme';

export default function AuthCallback() {
  const { loading, user } = useAuth();

  // Se o AuthContext já processou o token e temos um usuário,
  // redirecionamos para o feed.
  if (user) {
    return <Redirect href="/(tabs)/feed" />;
  }

  // Enquanto o AuthContext estiver em estado de carregamento (processando o token da URL),
  // exibimos um indicador de atividade. Se o login falhar, o próprio
  // AuthContext irá limpar o estado e o layout principal redirecionará para a home.
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
