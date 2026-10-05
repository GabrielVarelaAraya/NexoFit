import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, type RoleType } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { useOrgMembers, type OrgMember } from '../../hooks/useAdmin';
import { Header, Card } from '../../components/ui';

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

export function ClientsScreen() {
  const { user, membership } = useAuth();
  const orgId = membership?.organization_id ?? '';
  const isAdmin = membership?.role === 'admin';
  const { members, loading, error, refresh, updateRole } = useOrgMembers(orgId);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'member' | 'coach' | 'professional'>('all');
  const [changingId, setChangingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const filteredMembers = members.filter((m) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term || m.fullName?.toLowerCase().includes(term) || m.phone?.toLowerCase().includes(term);
    const matchesRole = filterRole === 'all' || m.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const applyRole = async (member: OrgMember, role: RoleType) => {
    setChangingId(member.membershipId);
    const result = await updateRole(member.membershipId, role);
    setChangingId(null);

    if (!result.success) {
      Alert.alert('No se pudo cambiar el rol', result.error ?? 'Inténtalo de nuevo.');
    }
  };

  const requestRoleChange = (member: OrgMember) => {
    if (!isAdmin) {
      Alert.alert('Sin permiso', 'Solo el administrador del gimnasio puede cambiar roles.');
      return;
    }
    if (member.profileId === user?.id) {
      Alert.alert('Atención', 'No puedes cambiar tu propio rol.');
      return;
    }

    const options: RoleType[] = ['member', 'coach', 'professional', 'admin'];
    Alert.alert('Cambiar rol', `Selecciona el nuevo rol de ${member.fullName ?? 'este miembro'}:`, [
      ...options.map((role) => ({
        text: roleLabels[role],
        onPress: () => applyRole(member, role),
      })),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  const renderMember = ({ item }: { item: OrgMember }) => {
    const roleColor = roleColors[item.role];
    const initial =
      item.fullName?.charAt(0)?.toUpperCase() ?? item.phone?.charAt(0)?.toUpperCase() ?? '?';
    const isChanging = changingId === item.membershipId;

    return (
      <Card style={styles.memberCard}>
        <View style={styles.memberHeader}>
          <View style={styles.memberAvatar}>
            {item.avatarUrl ? (
              <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{item.fullName ?? 'Sin nombre'}</Text>
            <Text style={styles.memberEmail}>
              {item.phone ? `Tel. ${item.phone}` : 'Sin teléfono registrado'}
            </Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{roleLabels[item.role]}</Text>
          </View>
        </View>
        <View style={styles.memberFooter}>
          <Text style={styles.joinedDate}>Miembro desde: {formatDate(item.joinedAt)}</Text>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.roleSelector, { borderColor: roleColor }]}
              disabled={isChanging}
              onPress={() => requestRoleChange(item)}
            >
              {isChanging ? (
                <ActivityIndicator size="small" color={roleColor} />
              ) : (
                <Text style={[styles.roleSelectorText, { color: roleColor }]}>Cambiar rol</Text>
              )}
            </TouchableOpacity>
          )}
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
      <Header
        title="Clientes"
        subtitle={isAdmin ? 'Gestiona tus miembros' : 'Solo lectura (rol entrenador)'}
      />

      {/* Search & Filters */}
      <View style={styles.filters}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o teléfono"
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
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      {/* Members List */}
      <FlatList
        data={filteredMembers}
        keyExtractor={(m) => m.membershipId}
        renderItem={renderMember}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.turquesa} />
              <Text style={styles.emptyHint}>Cargando miembros…</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Sin miembros</Text>
              <Text style={styles.emptyHint}>No hay miembros que coincidan con la búsqueda.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

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
  error: { fontFamily: fonts.uiRegular, fontSize: 12, color: '#EF4444' },
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
    overflow: 'hidden',
  },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
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
  roleSelector: {
    minWidth: 110,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleSelectorText: { fontFamily: fonts.uiSemiBold, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 80 },
  emptyTitle: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
  emptyHint: { fontFamily: fonts.uiRegular, fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
