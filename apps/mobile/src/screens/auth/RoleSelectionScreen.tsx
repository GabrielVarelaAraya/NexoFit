import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@nexofit/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'RoleSelection'>;
}

type Role = 'client' | 'gym_owner';

const roles = [
  {
    id: 'client' as Role,
    title: 'Soy cliente',
    description: 'Reservas, progreso y citas',
    icon: '👤',
    iconBg: '#A9F56F',
  },
  {
    id: 'gym_owner' as Role,
    title: 'Represento un gimnasio',
    description: 'Administra tu establecimiento',
    icon: '🏢',
    iconBg: '#E5E7EB',
  },
];

export function RoleSelectionScreen({ navigation }: Props) {
  const theme = useTheme();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const handleContinue = () => {
    if (selectedRole === 'client') {
      navigation.navigate('Login');
    } else if (selectedRole === 'gym_owner') {
      navigation.navigate('SignUp');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.crema }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.azulNexo }]}>¿Cómo usarás NexoFit?</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Elige la opción que mejor te describe.
        </Text>

        <View style={styles.rolesContainer}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={[
                styles.roleCard,
                {
                  backgroundColor: theme.white,
                  borderColor: selectedRole === role.id ? theme.turquesa : 'transparent',
                },
              ]}
              onPress={() => setSelectedRole(role.id)}
              activeOpacity={0.7}
            >
              <View style={styles.roleContent}>
                <View style={styles.roleTextContainer}>
                  <Text style={[styles.roleTitle, { color: theme.azulNexo }]}>{role.title}</Text>
                  <Text style={[styles.roleDescription, { color: theme.textSecondary }]}>
                    {role.description}
                  </Text>
                </View>
                <View style={[styles.roleIcon, { backgroundColor: role.iconBg }]}>
                  <Text style={styles.roleIconText}>{role.icon}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: selectedRole ? theme.turquesa : theme.turquesa + '60',
          },
        ]}
        onPress={handleContinue}
        disabled={!selectedRole}
        activeOpacity={0.8}
      >
        <Text style={[styles.buttonText, { color: theme.white }]}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    marginBottom: 40,
  },
  rolesContainer: {
    gap: 16,
  },
  roleCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
  },
  roleContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleTextContainer: {
    flex: 1,
  },
  roleTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginBottom: 4,
  },
  roleDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleIconText: {
    fontSize: 24,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
});
