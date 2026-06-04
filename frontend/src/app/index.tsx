import {{ Text, View }} from 'react-native';
import {{ StyleSheet }} from 'react-native';

export default function HomeScreen() {{
  return (
    <View style={{styles.container}}>
      <Text style={{styles.title}}>Bem-vindo ao Besord</Text>
    </View>
  );
}}

const styles = StyleSheet.create({{
  container: {{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }},
  title: {{
    fontSize: 24,
    fontWeight: 'bold',
  }},
}});
