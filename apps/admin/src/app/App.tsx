import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { ThemeProvider, colors, fonts, setSupabaseConfig } from '@nexofit/core';
import { LoadingView } from '../components/ui';
import { useAdminSession } from '../hooks/useAdminData';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { MembersScreen } from '../screens/MembersScreen';
import { PaymentsScreen } from '../screens/PaymentsScreen';
import { AgendaScreen } from '../screens/AgendaScreen';
import { VIEW_TITLES, useRoute, type ViewName } from './router';

// Configurar Supabase con las variables del .env (vía app.config.js).
const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (supabaseUrl && supabaseAnonKey) {
  setSupabaseConfig({ url: supabaseUrl, key: supabaseAnonKey });
} else {
  console.warn(
    'Supabase credentials not found in app.config.js extra. Check your .env and app.config.js'
  );
}

type IconName = keyof typeof Ionicons.glyphMap;

// Menú agrupado como en la app móvil: operación del día y finanzas.
const NAV_GROUPS: { title: string; items: { id: ViewName; icon: IconName }[] }[] = [
  {
    title: 'Operación',
    items: [
      { id: 'dashboard', icon: 'grid-outline' },
      { id: 'agenda', icon: 'calendar-outline' },
      { id: 'members', icon: 'people-outline' },
    ],
  },
  { title: 'Finanzas', items: [{ id: 'payments', icon: 'cash-outline' }] },
];

export default function App() {
  // Sin esto, los fontFamily de @nexofit/core caen a la fuente serif del navegador.
  const [fontsLoaded] = useFonts({
    Nunito_800ExtraBold,
    Inter_400Regular,
    Inter_600SemiBold,
    ...Ionicons.font,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.center}>
        <LoadingView label="Cargando consola…" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <StatusBar style="light" />
      <AdminShell />
    </ThemeProvider>
  );
}

function AdminShell() {
  const { session, membership, loading, accessError, signIn, signOut } = useAdminSession();
  const { route, navigate } = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const { width } = useWindowDimensions();
  const compact = width < 768;

  if (loading) {
    return (
      <View style={styles.center}>
        <LoadingView label="Verificando acceso…" />
      </View>
    );
  }

  if (!session) {
    return <LoginScreen onSignIn={signIn} />;
  }

  if (!membership) {
    return (
      <View style={styles.center}>
        <View style={styles.deniedCard}>
          <Text style={styles.deniedTitle}>Acceso no disponible</Text>
          <Text style={styles.deniedText}>
            {accessError ?? 'Esta cuenta no puede usar la consola de administración.'}
          </Text>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={() => void signOut()}
            accessibilityRole="button"
          >
            <Text style={styles.signOutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const go = (view: ViewName) => {
    setMenuOpen(false);
    navigate(view);
  };

  const navList = (
    <View style={styles.nav}>
      {NAV_GROUPS.map((group) => (
        <View key={group.title} style={styles.navGroup}>
          <Text style={styles.navGroupTitle}>{group.title}</Text>
          {group.items.map((item) => {
            const active = route.view === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => go(item.id)}
                activeOpacity={0.8}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                accessibilityLabel={VIEW_TITLES[item.id]}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={active ? colors.white : colors.white + 'B3'}
                />
                <Text style={[styles.navText, active && styles.navTextActive]}>
                  {VIEW_TITLES[item.id]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );

  const account = (
    <View style={styles.sidebarFooter}>
      <Text style={styles.orgName}>{membership.organizationName}</Text>
      <Text style={styles.userEmail} numberOfLines={1}>
        {session.user.email}
      </Text>
      <TouchableOpacity
        style={styles.signOutLink}
        onPress={() => void signOut()}
        accessibilityRole="button"
      >
        <Text style={styles.signOutLinkText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );

  const screen = (() => {
    const props = {
      organizationId: membership.organizationId,
      navigate,
      params: route.params,
      currentUserId: session.user.id,
    };
    switch (route.view) {
      case 'agenda':
        return <AgendaScreen {...props} />;
      case 'members':
        return <MembersScreen {...props} />;
      case 'payments':
        return <PaymentsScreen {...props} />;
      default:
        return <DashboardScreen {...props} />;
    }
  })();

  return (
    <View style={[styles.shell, compact && styles.shellCompact]}>
      {compact ? (
        // Angosto: barra con menú hamburguesa (antes la navegación se partía en 2 líneas).
        <View>
          <View style={styles.topBar}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              accessibilityState={{ expanded: menuOpen }}
              onPress={() => setMenuOpen((open) => !open)}
              hitSlop={8}
            >
              <Ionicons name={menuOpen ? 'close' : 'menu'} size={24} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.brandCompact}>NexoFit</Text>
            <Text style={styles.topBarTitle} numberOfLines={1}>
              {VIEW_TITLES[route.view]}
            </Text>
          </View>
          {menuOpen && (
            <View style={styles.dropdown}>
              {navList}
              {account}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.sidebar}>
          <View>
            <Text style={styles.brand}>NexoFit</Text>
            <Text style={styles.brandSub}>Consola de administración</Text>
          </View>
          {navList}
          {account}
        </View>
      )}

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={[styles.content, compact && styles.contentCompact]}
      >
        {screen}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.crema,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deniedCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 32,
    maxWidth: 460,
    gap: 12,
    alignItems: 'center',
  },
  deniedTitle: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
  deniedText: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  signOutButton: {
    marginTop: 8,
    backgroundColor: colors.textAccent,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  signOutText: { fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.crema },
  shell: { flex: 1, flexDirection: 'row', backgroundColor: colors.crema },
  shellCompact: { flexDirection: 'column' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.azulNexo,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  brandCompact: { fontFamily: fonts.brand, fontSize: 18, color: colors.white },
  topBarTitle: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.white + 'CC',
  },
  dropdown: {
    backgroundColor: colors.azulNexo,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  sidebar: {
    width: 248,
    backgroundColor: colors.azulNexo,
    padding: 24,
  },
  brand: { fontFamily: fonts.brand, fontSize: 24, color: colors.white },
  brandSub: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.white + 'B3',
    marginTop: 4,
  },
  // Navegación pegada arriba, bajo la marca; el pie (organización/salir) al fondo.
  nav: { gap: 20, marginTop: 32, flex: 1 },
  navGroup: { gap: 4 },
  navGroupTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.white + '80',
    marginBottom: 4,
    marginLeft: 14,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  navItemActive: { backgroundColor: colors.white + '1F' },
  navText: { fontFamily: fonts.uiRegular, fontSize: 15, color: colors.white + 'CC' },
  navTextActive: { fontFamily: fonts.uiSemiBold, color: colors.white },
  sidebarFooter: { gap: 4 },
  orgName: { fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.white },
  userEmail: { fontFamily: fonts.uiRegular, fontSize: 12, color: colors.white + 'B3' },
  signOutLink: { marginTop: 10 },
  signOutLinkText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.limaProgreso,
  },
  contentScroll: { flex: 1 },
  content: { padding: 32, maxWidth: 1280, width: '100%' },
  contentCompact: { padding: 16 },
});
