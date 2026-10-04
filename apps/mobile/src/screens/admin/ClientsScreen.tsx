import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Card } from '../../components/ui';

interface Member {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'coach' | 'professional' | 'member';
  joined_at: string;
  avatar_url?: string;
}

export function ClientsScreen() {
  const { membership } = useAuth();
  const orgId = membership?.organization_id ?? '';
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'member' | 'coach' | 'professional'>('all');

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    // TODO: Replace with actual Supabase query
    await new Promise((r) => setTimeout(r, 500));
    setMembers(mockMembers);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMembers();
    }, [fetchMembers])
  );

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = filterRole === 'all' || m.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    coach: 'Entrenador',
    professional: 'Profesional',
    member: 'Miembro',
  };

  const roleColors: Record<string, string> = {
    admin: '#EF4444',
    coach: '#8B5CF6',
    professional: '#06B6D4',
    member: colors.turquesa,
  };

  const handleRoleChange = (memberId: string, newRole: Member['role']) => {
    // TODO: Implement actual role update
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
  };

  const renderMember = ({ item }: { item: Member }) => {
    const roleColor = roleColors[item.role];

    return (
      <Card style={styles.memberCard}>
        <View style={styles.memberHeader}>
          <View style={styles.memberAvatar}>
            {item.avatar_url ? null : (
              <Text style={styles.avatarText}>
                {item.full_name?.charAt(0)?.toUpperCase() ??
                  item.email?.charAt(0)?.toUpperCase() ??
                  '?'}
              </Text>
            )}
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{item.full_name ?? 'Sin nombre'}</Text>
            <Text style={styles.memberEmail}>{item.email}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{roleLabels[item.role]}</Text>
          </View>
        </View>
        <View style={styles.memberFooter}>
          <Text style={styles.joinedDate}>Miembro desde: {formatDate(item.joined_at)}</Text>
          <TouchableOpacity
            style={[styles.roleSelector, { borderColor: roleColor }]}
            onPress={() => {
              const roles: Member['role'][] = ['member', 'coach', 'professional', 'admin'];
              const currentIndex = roles.indexOf(item.role);
              const nextRole = roles[(currentIndex + 1) % roles.length];
              handleRoleChange(item.id, nextRole);
            }}
          >
            <Text style={[styles.roleSelectorText, { color: roleColor }]}>Cambiar rol</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  if (!orgId) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Clientes" subtitle="Selecciona una organización" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Sin organización</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Clientes" subtitle="Gestiona tus miembros" />

      {/* Search & Filters */}
      <View style={styles.filters}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o email"
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.roleFilters}>
          {(['all', 'member', 'coach', 'professional'] as const).map((role) => (
            <TouchableOpacity
              key={role}
              style={[
                styles.filterChip,
                filterRole === role && {
                  backgroundColor: colors.turquesa,
                  borderColor: colors.turquesa,
                },
              ]}
              onPress={() => setFilterRole(role)}
            >
              <Text style={[styles.filterChipText, filterRole === role && { color: colors.white }]}>
                {role === 'all' ? 'Todos' : roleLabels[role]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Members List */}
      <FlatList
        data={filteredMembers}
        keyExtractor={(m) => m.id}
        renderItem={renderMember}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchMembers} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Sin miembros</Text>
              <Text style={styles.emptyHint}>No hay miembros que coincidan con la búsqueda.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const mockMembers: Member[] = [
  {
    id: '1',
    email: 'maria@email.com',
    full_name: 'María García',
    role: 'member',
    joined_at: '2024-01-15T00:00:00Z',
  },
  {
    id: '2',
    email: 'carlos@email.com',
    full_name: 'Carlos López',
    role: 'member',
    joined_at: '2024-02-20T00:00:00Z',
  },
  {
    id: '3',
    email: 'laura@email.com',
    full_name: 'Laura Martín',
    role: 'coach',
    joined_at: '2023-11-10T00:00:00Z',
  },
  {
    id: '4',
    email: 'pedro@email.com',
    full_name: 'Pedro González',
    role: 'coach',
    joined_at: '2023-09-01T00:00:00Z',
  },
  {
    id: '5',
    email: 'ana@email.com',
    full_name: 'Ana Ruiz',
    role: 'professional',
    joined_at: '2024-03-01T00:00:00Z',
  },
  {
    id: '6',
    email: 'admin@nexofit.com',
    full_name: 'Admin Principal',
    role: 'admin',
    joined_at: '2023-01-01T00:00:00Z',
  },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  filters: { paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  searchInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.uiRegular,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.azulNexo + '20',
    color: colors.azulNexo,
  },
  roleFilters: { flexDirection: 'row', gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.azulNexo + '20',
  },
  filterChipText: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.azulNexo },
  list: { padding: 16, gap: 12, paddingBottom: 24 },
  memberCard: { gap: 12 },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.turquesa + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontFamily: fonts.brand, fontSize: 18, color: colors.turquesa },
  memberInfo: { flex: 1, gap: 2 },
  memberName: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: colors.azulNexo },
  memberEmail: { fontFamily: fonts.uiRegular, fontSize: 13, color: '#9CA3AF' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleText: { fontFamily: fonts.uiSemiBold, fontSize: 11 },
  memberFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  joinedDate: { fontFamily: fonts.uiRegular, fontSize: 12, color: '#9CA3AF' },
  roleSelector: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  roleSelectorText: { fontFamily: fonts.uiSemiBold, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 80 },
  emptyTitle: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
  emptyHint: { fontFamily: fonts.uiRegular, fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
