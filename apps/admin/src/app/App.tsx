import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { ThemeProvider, colors, fonts, setSupabaseConfig } from '@nexofit/core';
import { LoadingView } from '../components/ui';
import { useAdminSession } from '../hooks/useAdminData';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { MembersScreen } from '../screens/MembersScreen';
import { PaymentsScreen } from '../screens/PaymentsScreen';

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

type ViewName = 'dashboard' | 'members' | 'payments';

const NAV_ITEMS: { id: ViewName; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'members', label: 'Miembros' },
  { id: 'payments', label: 'Pagos' },
];

export default function App() {
  return (
    <ThemeProvider>
      <StatusBar style="light" />
      <AdminShell />
    </ThemeProvider>
  );
}

function AdminShell() {
  const { session, membership, loading, accessError, signIn, signOut } = useAdminSession();
  const [view, setView] = useState<ViewName>('dashboard');
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

  return (
    <View style={[styles.shell, compact && styles.shellCompact]}>
      {compact ? (
        <View style={styles.topBar}>
          <View style={styles.topBarBrand}>
            <Text style={styles.brandCompact}>NexoFit</Text>
          </View>
          <View style={styles.topNav}>
            {NAV_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.topNavItem, view === item.id && styles.topNavItemActive]}
                onPress={() => setView(item.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <Text style={[styles.topNavText, view === item.id && styles.topNavTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.topSignOut} onPress={() => void signOut()}>
            <Text style={styles.signOutLinkText}>Salir</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.sidebar}>
          <View>
            <Text style={styles.brand}>NexoFit</Text>
            <Text style={styles.brandSub}>Consola de administración</Text>
          </View>

          <View style={styles.nav}>
            {NAV_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.navItem, view === item.id && styles.navItemActive]}
                onPress={() => setView(item.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <Text style={[styles.navText, view === item.id && styles.navTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

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
        </View>
      )}

      <View style={[styles.content, compact && styles.contentCompact]}>
        {view === 'dashboard' && <DashboardScreen organizationId={membership.organizationId} />}
        {view === 'members' && <MembersScreen organizationId={membership.organizationId} />}
        {view === 'payments' && <PaymentsScreen organizationId={membership.organizationId} />}
      </View>
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
    borderColor: '#E5E7EB',
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
    flexWrap: 'wrap',
  },
  topBarBrand: { marginRight: 8 },
  brandCompact: { fontFamily: fonts.brand, fontSize: 18, color: colors.white },
  topNav: { flexDirection: 'row', gap: 4, flex: 1, flexWrap: 'wrap' },
  topNavItem: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  topNavItemActive: { backgroundColor: colors.white + '1F' },
  topNavText: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.white + 'CC' },
  topNavTextActive: { fontFamily: fonts.uiSemiBold, color: colors.white },
  topSignOut: { paddingHorizontal: 10, paddingVertical: 6 },
  contentCompact: { padding: 16 },
  sidebar: {
    width: 260,
    backgroundColor: colors.azulNexo,
    padding: 24,
    justifyContent: 'space-between',
  },
  brand: { fontFamily: fonts.brand, fontSize: 24, color: colors.white },
  brandSub: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.white + 'B3',
    marginTop: 4,
  },
  nav: { gap: 8 },
  navItem: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
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
  content: { flex: 1, padding: 32, overflow: 'scroll' },
});
