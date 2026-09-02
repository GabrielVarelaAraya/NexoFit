import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { colors, fonts } from '@nexofit/core';

export function HomeScreen() {
  const { user, membership, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NexoFit</Text>
      <Text style={styles.subtitle}>Welcome, {user?.email}</Text>
      {membership && <Text style={styles.role}>Role: {membership.role}</Text>}

      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.crema,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: fonts.brand,
    fontSize: 28,
    color: colors.azulNexo,
  },
  subtitle: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.turquesa,
    marginTop: 8,
  },
  role: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.azulNexo + 'AA',
    marginTop: 4,
  },
  button: {
    marginTop: 32,
    backgroundColor: colors.azulNexo,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.crema,
  },
});
