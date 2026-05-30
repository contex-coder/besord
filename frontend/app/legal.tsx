import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/src/theme";

const TERMS = `# TERMOS E CONDIÇÕES DE UTILIZAÇÃO

**Última atualização**: 30 de Maio de 2026
**Aplicação**: Besord
**Entidade responsável**: Rodrigo Conte Cunha, Lisboa, Portugal
**Contacto**: rodrigocontecunha@gmail.com

## 1. Aceitação dos termos
Ao criar conta ou utilizar a aplicação Besord ("Aplicação"), o Utilizador aceita integralmente os presentes Termos e Condições. Se não concordar, deverá abster-se de utilizar o serviço.

## 2. Descrição do serviço
O Besord é uma rede social que permite publicar imagens descritas por UMA única palavra, votar "Aprovo" ou "Desaprovo" em publicações alheias, comentar com UMA palavra e, opcionalmente, contratar campanhas patrocinadas para recolha de feedback de mercado.

## 3. Conta de utilizador
3.1. O acesso requer autenticação via Google ou Apple Sign-In.
3.2. O Utilizador deve ter pelo menos 16 anos (idade mínima para consentimento RGPD em Portugal).
3.3. O Utilizador é responsável pela veracidade das informações fornecidas e pela segurança da sua conta.

## 4. Conduta do utilizador
É expressamente proibido publicar conteúdo que:
- viole direitos de propriedade intelectual, imagem ou privacidade de terceiros;
- contenha pornografia, violência gráfica, discurso de ódio, incitamento à discriminação;
- promova actividades ilegais, fraude ou perigo público;
- inclua dados pessoais de terceiros sem consentimento.

Posts denunciados por 3 ou mais utilizadores são automaticamente ocultados.

## 5. Conteúdo do utilizador
5.1. O Utilizador mantém todos os direitos sobre as imagens que publica.
5.2. Ao publicar, concede ao Besord uma licença não exclusiva, gratuita, mundial para exibir, distribuir e armazenar tecnicamente o conteúdo no contexto da aplicação.
5.3. O Utilizador garante que detém os direitos sobre as imagens publicadas.

## 6. Campanhas patrocinadas (B2B)
6.1. Disponíveis a quem ative o perfil empresarial.
6.2. Pagamento processado pela Stripe Inc. (USD), com taxas indicadas no momento da compra.
6.3. Os planos têm duração e número de votos incluídos pré-definidos. Após esgotamento da duração, a campanha termina.
6.4. Não há reembolso após início da campanha, salvo falha técnica imputável ao Besord.
6.5. Códigos promocionais sujeitos a disponibilidade e condições publicadas.

## 7. Relatórios e dados agregados
Os relatórios de campanha contêm apenas dados estatísticos agregados por região geográfica, nunca identificadores pessoais de votantes individuais.

## 8. Propriedade intelectual
A marca "Besord", logótipo, mascote ("Besoura") e o software são propriedade exclusiva do titular da aplicação e estão protegidos pelas leis portuguesas e europeias.

## 9. Limitação de responsabilidade
O serviço é fornecido "tal como está". O Besord não se responsabiliza por:
- conteúdo publicado por utilizadores;
- decisões comerciais baseadas em relatórios de campanha;
- interrupções, perdas de dados ou indisponibilidades temporárias.

## 10. Cessação
O Besord reserva-se o direito de suspender ou eliminar contas que violem estes Termos, sem aviso prévio em casos graves.

## 11. Lei aplicável e foro
Os presentes Termos regem-se pela lei portuguesa. Para questões consumeristas aplica-se a Lei de Defesa do Consumidor. Foro: Tribunais da Comarca de Lisboa.

## 12. Resolução alternativa de litígios
Conforme art.º 18.º da Lei n.º 144/2015, informa-se que pode recorrer ao Centro Nacional de Informação e Arbitragem de Conflitos de Consumo (CNIACC — www.arbitragemdeconsumo.org).

## 13. Alterações
Estes Termos podem ser actualizados. Mudanças materiais serão comunicadas via aplicação. O uso continuado após a alteração constitui aceitação.

`;

const PRIVACY = `# POLÍTICA DE PRIVACIDADE

**Última atualização**: 30 de Maio de 2026
**Responsável pelo tratamento**: Rodrigo Conte Cunha, Lisboa, Portugal
**Contacto DPO/Encarregado**: rodrigocontecunha@gmail.com

Esta política descreve como o Besord recolhe, utiliza e protege os dados pessoais, em conformidade com o **Regulamento (UE) 2016/679 (RGPD)** e a **Lei n.º 58/2019**.

## 1. Dados recolhidos
**Conta**: nome, email, foto de perfil (via Google/Apple Sign-In).
**Conteúdo**: imagens, palavras, votos, comentários publicados.
**Localização aproximada**: país/região/cidade derivados do endereço IP, para agregação estatística em relatórios.
**Técnicos**: endereço IP, identificadores de sessão, tipo de dispositivo.
**Pagamento (apenas anunciantes)**: dados de facturação processados pela Stripe; não armazenamos números de cartão.

## 2. Finalidades do tratamento
- Permitir o funcionamento da aplicação (autenticação, publicação, votação).
- Gerar relatórios estatísticos agregados para anunciantes (sem identificação individual).
- Prevenção de fraude e moderação.
- Cumprimento de obrigações legais.

## 3. Bases legais
- **Execução do contrato** (art.º 6.º/1/b RGPD): conta, publicação, votação, campanhas.
- **Interesse legítimo** (art.º 6.º/1/f RGPD): geolocalização agregada, prevenção de fraude.
- **Consentimento** (art.º 6.º/1/a RGPD): comunicações de marketing (quando aplicável).

## 4. Partilha com terceiros
- **Google / Apple**: autenticação.
- **Stripe**: processamento de pagamentos.
- **ip-api.com**: geolocalização de IP (não recebe dados pessoais; apenas o IP).
- **MongoDB**: armazenamento de dados (servidor configurado pelo responsável).
Não vendemos dados pessoais a terceiros.

## 5. Transferências internacionais
Sub-processadores podem estar localizados nos EUA (Stripe, Google, Apple). Aplicam-se cláusulas contratuais-tipo da Comissão Europeia.

## 6. Período de conservação
- Dados de conta: enquanto a conta estiver activa + 30 dias após eliminação.
- Conteúdo publicado: até eliminação pelo utilizador ou pelo Besord.
- Relatórios agregados: 24 meses.
- Dados fiscais (anunciantes): 10 anos (obrigação legal portuguesa).

## 7. Direitos do titular (RGPD)
Pode exercer a qualquer momento os direitos de:
- **acesso** aos seus dados;
- **rectificação**;
- **apagamento** ("direito a ser esquecido");
- **limitação** do tratamento;
- **portabilidade**;
- **oposição** ao tratamento;
- **retirada do consentimento** (quando aplicável).

Para exercer, envie email para **rodrigocontecunha@gmail.com**. Responderemos em até 30 dias.

## 8. Reclamações
Em caso de não-conformidade, pode apresentar reclamação à **Comissão Nacional de Protecção de Dados (CNPD)** — www.cnpd.pt — Av. D. Carlos I, n.º 134, 1.º, 1200-651 Lisboa.

## 9. Cookies e tecnologias similares
A versão web utiliza apenas armazenamento local (token de sessão) — sem cookies de rastreio publicitário.

## 10. Menores de idade
Idade mínima: 16 anos. Caso identifiquemos contas de menores, serão eliminadas. Pais/tutores podem solicitar eliminação por email.

## 11. Segurança
Implementamos medidas técnicas adequadas: encriptação em trânsito (HTTPS), tokens de sessão com expiração, isolamento de dados de pagamento via Stripe.

## 12. Alterações a esta política
Comunicaremos qualquer alteração material via aplicação. A versão actual está sempre acessível em /legal/privacy.

`;

export default function LegalScreen() {
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const isPrivacy = doc === "privacy";
  const content = isPrivacy ? PRIVACY : TERMS;
  const title = isPrivacy ? "POLÍTICA DE PRIVACIDADE" : "TERMOS E CONDIÇÕES";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {content.split("\n").map((line, i) => {
          if (line.startsWith("# ")) return <Text key={i} style={styles.h1}>{line.replace("# ", "")}</Text>;
          if (line.startsWith("## ")) return <Text key={i} style={styles.h2}>{line.replace("## ", "")}</Text>;
          if (line.startsWith("**")) return <Text key={i} style={styles.bold}>{line.replace(/\*\*/g, "")}</Text>;
          if (line.startsWith("- ")) return <Text key={i} style={styles.li}>• {line.replace("- ", "")}</Text>;
          if (line.trim() === "") return <View key={i} style={{ height: 8 }} />;
          return <Text key={i} style={styles.p}>{line}</Text>;
        })}
        <View style={{ height: 40 }} />
        <TouchableOpacity style={styles.switchBtn} onPress={() => router.replace(`/legal?doc=${isPrivacy ? "terms" : "privacy"}`)}>
          <Text style={styles.switchText}>VER {isPrivacy ? "TERMOS" : "PRIVACIDADE"} →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 4, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderWidth: 3, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: "900", letterSpacing: 1, color: colors.text },
  content: { padding: 20, paddingBottom: 60 },
  h1: { fontSize: 26, fontWeight: "900", letterSpacing: -0.5, color: colors.text, marginTop: 8, marginBottom: 8 },
  h2: { fontSize: 16, fontWeight: "900", letterSpacing: 0.5, color: colors.text, marginTop: 18, marginBottom: 6 },
  bold: { fontSize: 13, fontWeight: "900", color: colors.text, marginVertical: 2 },
  p: { fontSize: 13, fontWeight: "500", color: colors.text, lineHeight: 19 },
  li: { fontSize: 13, fontWeight: "500", color: colors.text, lineHeight: 19, marginLeft: 8 },
  switchBtn: { borderWidth: 3, borderColor: colors.border, padding: 14, alignItems: "center", backgroundColor: colors.neutral },
  switchText: { fontSize: 14, fontWeight: "900", letterSpacing: 1, color: colors.text },
});
