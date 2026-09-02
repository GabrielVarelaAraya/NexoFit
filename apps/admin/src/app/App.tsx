import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@nexofit/core';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>NexoFit Admin</Text>
      <Text style={styles.tagline}>Gestión de operaciones</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.crema,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.azulNexo,
    fontFamily: fonts.brand,
    fontSize: 28,
  },
  tagline: {
    marginTop: 8,
    color: colors.turquesa,
    fontFamily: fonts.uiRegular,
    fontSize: 16,
  },
});
