import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { colors, fonts } from '@nexofit/core';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Card } from '../../components/ui';
import { confirmAction, notify } from '../../utils/alerts';
import type { NavigationProp } from '../../types/screens';

type MenuItemType = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  destructive?: boolean;
};

// «Más» es configuración y cuenta. Las operaciones del día (nueva clase,
// publicar programa, notificar, pagos) viven en las acciones rápidas del
// Dashboard; antes se repetían aquí.
// Planes y pagos es solo admin: la RLS de payments solo deja ver el libro al admin.
function buildGymItems(navigation: NavigationProp, isAdmin: boolean): MenuItemType[] {
  return [
    {
      icon: 'business',
      title: 'Espacios y clases',
      subtitle: 'Sedes, espacios y tipos de clase',
      onPress: () => navigation.navigate('GymContent'),
    },
    ...(isAdmin
      ? ([
          {
            icon: 'pricetags',
            title: 'Planes y pagos',
            subtitle: 'Planes de membresía e historial de cobros',
            onPress: () => navigation.navigate('Payments'),
          },
        ] satisfies MenuItemType[])
      : []),
  ];
}

export function MoreScreen({ navigation }: { navigation: NavigationProp }) {
  const { membership, signOut } = useAuth();
  const orgId = membership?.organization_id ?? '';

  const handleSignOut = () => {
    confirmAction({
      title: 'Cerrar sesión',
      message: '¿Seguro que quieres salir de tu cuenta?',
      confirmLabel: 'Cerrar sesión',
      onConfirm: signOut,
    });
  };

  if (!orgId) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Más" subtitle="Selecciona una organización" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Sin organización</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isAdmin = membership?.role === 'admin';
  const accountItems: MenuItemType[] = [
    {
      icon: 'help-circle',
      title: 'Ayuda y soporte',
      subtitle: 'Cómo resolver dudas frecuentes',
      onPress: () =>
        notify(
          'Para problemas de acceso o datos de miembros, revisa Clientes y Pagos. Si algo no funciona, escríbenos desde el correo de tu cuenta.',
          'Ayuda y soporte'
        ),
    },
    {
      icon: 'log-out',
      title: 'Cerrar sesión',
      subtitle: 'Salir de tu cuenta',
      onPress: handleSignOut,
      destructive: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Más" subtitle={isAdmin ? 'Administración' : 'Entrenador'} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.groupTitle}>{membership?.organization_name ?? 'Gimnasio'}</Text>
        <Card style={styles.menuCard}>
          {buildGymItems(navigation, isAdmin).map((item) => (
            <MenuItem key={item.title} item={item} />
          ))}
        </Card>

        <Text style={styles.groupTitle}>Cuenta</Text>
        <Card style={styles.menuCard}>
          {accountItems.map((item) => (
            <MenuItem key={item.title} item={item} />
          ))}
        </Card>

        <View style={styles.version}>
          <Text style={styles.versionText}>NexoFit v0.1.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ item }: { item: MenuItemType }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={styles.menuItem}
      onPress={item.onPress}
      activeOpacity={0.7}
      accessibilityLabel={item.title}
    >
      <Ionicons
        name={item.icon}
        size={22}
        color={item.destructive ? colors.textError : colors.azulNexo}
        style={styles.menuIcon}
      />
      <View style={styles.menuText}>
        <Text style={[styles.menuTitle, item.destructive && { color: colors.textError }]}>
          {item.title}
        </Text>
        <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  groupTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    marginLeft: 4,
  },
  menuCard: { gap: 0, padding: 0, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
    gap: 16,
  },
  menuIcon: { width: 28, textAlign: 'center' },
  menuText: { flex: 1, gap: 2 },
  menuTitle: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: colors.azulNexo },
  menuSubtitle: { fontFamily: fonts.uiRegular, fontSize: 12, color: colors.textSecondary },
  version: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  versionText: { fontFamily: fonts.uiRegular, fontSize: 12, color: colors.textSecondary },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
});
