import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Card } from '../../components/ui';

type MenuItemType = {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  destructive?: boolean;
};

const menuItems: MenuItemType[] = [
  {
    icon: '🏢',
    title: 'Mi organización',
    subtitle: 'Datos, facturación, ajustes',
    onPress: () => {},
  },
  {
    icon: '🏟️',
    title: 'Sedes y espacios',
    subtitle: 'Gestionar ubicaciones y capacidades',
    onPress: () => {},
  },
  {
    icon: '🏷️',
    title: 'Tipos de clase',
    subtitle: 'Crear y editar modalidades',
    onPress: () => {},
  },
  {
    icon: '👨‍🏫',
    title: 'Entrenadores',
    subtitle: 'Gestionar coaches y especialidades',
    onPress: () => {},
  },
  {
    icon: '👨‍⚕️',
    title: 'Profesionales',
    subtitle: 'Fisioterapeutas, nutricionistas, etc.',
    onPress: () => {},
  },
  {
    icon: '📋',
    title: 'Programas de entreno',
    subtitle: 'Crear WODs y rutinas',
    onPress: () => {},
  },
  { icon: '🔔', title: 'Notificaciones', subtitle: 'Enviar avisos a miembros', onPress: () => {} },
  {
    icon: '⚙️',
    title: 'Ajustes de la app',
    subtitle: 'Preferencias, tema, idioma',
    onPress: () => {},
  },
  { icon: '❓', title: 'Ayuda y soporte', subtitle: 'Documentación y contacto', onPress: () => {} },
];

const dangerItems: MenuItemType[] = [
  {
    icon: '🚪',
    title: 'Cerrar sesión',
    subtitle: 'Salir de tu cuenta',
    onPress: () => {},
    destructive: true,
  },
];

export function MoreScreen() {
  const { membership, signOut } = useAuth();
  const orgId = membership?.organization_id ?? '';

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: signOut },
    ]);
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

  const itemsWithSignOut = dangerItems.map((item) => ({
    ...item,
    onPress: handleSignOut,
  }));

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Más"
        subtitle={membership?.role === 'admin' ? 'Administración' : 'Entrenador'}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.menuCard}>
          {menuItems.map((item) => (
            <MenuItem key={item.title} item={item} />
          ))}
        </Card>

        <Card style={styles.menuCard}>
          {itemsWithSignOut.map((item) => (
            <MenuItem key={item.title} item={item} />
          ))}
        </Card>

        {/* App Version */}
        <View style={styles.version}>
          <Text style={styles.versionText}>NexoFit v0.1.0</Text>
          <Text style={styles.versionText}>Build: Development</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ item }: { item: MenuItemType }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
      <Text style={styles.menuIcon}>{item.icon}</Text>
      <View style={styles.menuText}>
        <Text style={[styles.menuTitle, item.destructive && { color: '#EF4444' }]}>
          {item.title}
        </Text>
        <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  menuCard: { gap: 0 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 16,
  },
  menuIcon: { fontSize: 24, width: 40, textAlign: 'center' },
  menuText: { flex: 1, gap: 2 },
  menuTitle: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: colors.azulNexo },
  menuSubtitle: { fontFamily: fonts.uiRegular, fontSize: 12, color: '#9CA3AF' },
  chevron: { fontFamily: fonts.uiRegular, fontSize: 20, color: '#9CA3AF' },
  version: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  versionText: { fontFamily: fonts.uiRegular, fontSize: 12, color: '#9CA3AF' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
});
