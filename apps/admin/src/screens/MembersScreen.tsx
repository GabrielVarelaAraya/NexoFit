import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, fonts, type RoleType } from '@nexofit/core';
import { Card, EmptyState, ErrorText, LoadingView } from '../components/ui';
import { useOrgMembers, type OrgMember } from '../hooks/useAdminData';
import { formatShortDate } from '../utils/format';

const ROLE_LABELS: Record<RoleType, string> = {
  member: 'Miembro',
  coach: 'Entrenador',
  professional: 'Profesional',
  admin: 'Administrador',
};

const ROLE_COLORS: Record<RoleType, string> = {
  member: colors.turquesa,
  coach: '#8B5CF6',
  professional: '#0EA5E9',
  admin: colors.azulNexo,
};

const ALL_ROLES: RoleType[] = ['member', 'coach', 'professional', 'admin'];

// Miembros del gimnasio con gestión de roles (misma RLS que la app móvil).
export function MembersScreen({ organizationId }: { organizationId: string }) {
  const { members, loading, error, updateRole } = useOrgMembers(organizationId);
  const [query, setQuery] = useState('');
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.fullName.toLowerCase().includes(q));
  }, [members, query]);

  const handleRoleChange = async (member: OrgMember, role: RoleType) => {
    if (role === member.role) {
      setOpenRoleId(null);
      return;
    }
    // En web no existe Alert: se usa el confirm nativo. El rol Administrador
    // otorga acceso total, así que nunca se aplica sin un paso explícito.
    const confirmed = window.confirm(
      `¿Cambiar el rol de ${member.fullName} a ${ROLE_LABELS[role]}? Se aplica de inmediato.`
    );
    setOpenRoleId(null);
    if (!confirmed) return;

    setRoleError(null);
    const result = await updateRole(member.membershipId, role);
    if (!result.success) setRoleError(result.error ?? 'No se pudo cambiar el rol.');
  };

  if (loading) return <LoadingView label="Cargando miembros…" />;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.h1}>Miembros</Text>
        <TextInput
          style={styles.search}
          placeholder="Buscar por nombre…"
          placeholderTextColor={colors.textPlaceholder}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {error && <ErrorText>{error}</ErrorText>}
      {roleError && <ErrorText>{roleError}</ErrorText>}

      <Card style={styles.table}>
        <View style={[styles.row, styles.headerTableRow]}>
          <Text style={[styles.cellName, styles.headerText]}>Miembro</Text>
          <Text style={[styles.cellPhone, styles.headerText]}>Teléfono</Text>
          <Text style={[styles.cellDate, styles.headerText]}>Alta</Text>
          <Text style={[styles.cellRole, styles.headerText]}>Rol</Text>
        </View>

        {filtered.length === 0 ? (
          // La búsqueda vacía no significa que la organización no tenga miembros.
          query.trim() ? (
            <EmptyState
              title="Sin resultados"
              subtitle={`No encontramos miembros que coincidan con «${query.trim()}».`}
            />
          ) : (
            <EmptyState title="Sin miembros" subtitle="Aún no hay miembros en esta organización." />
          )
        ) : (
          filtered.map((member) => (
            <View key={member.membershipId} style={styles.row}>
              <Text style={[styles.cellText, styles.cellName]}>{member.fullName}</Text>
              <Text style={[styles.cellText, styles.cellPhone]}>{member.phone ?? '—'}</Text>
              <Text style={[styles.cellText, styles.cellDate]}>
                {formatShortDate(member.createdAt)}
              </Text>
              <View style={styles.cellRole}>
                <TouchableOpacity
                  style={styles.roleButton}
                  onPress={() =>
                    setOpenRoleId(openRoleId === member.membershipId ? null : member.membershipId)
                  }
                  activeOpacity={0.8}
                >
                  <Text style={[styles.roleButtonText, { color: ROLE_COLORS[member.role] }]}>
                    {ROLE_LABELS[member.role]}
                  </Text>
                  <Text style={styles.roleChevron}>▾</Text>
                </TouchableOpacity>

                {openRoleId === member.membershipId && (
                  <View style={styles.roleMenu}>
                    {ALL_ROLES.map((role) => (
                      <TouchableOpacity
                        key={role}
                        style={styles.roleMenuItem}
                        onPress={() => void handleRoleChange(member, role)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.roleMenuText,
                            role === member.role && styles.roleMenuActive,
                          ]}
                        >
                          {ROLE_LABELS[role]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  h1: { fontFamily: fonts.brand, fontSize: 26, color: colors.azulNexo },
  search: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 260,
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.azulNexo,
  },
  table: { padding: 8, gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  headerTableRow: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerText: { fontFamily: fonts.uiSemiBold, fontSize: 12, color: colors.textSecondary },
  cellText: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.azulNexo },
  cellName: { flex: 2, minWidth: 160 },
  cellPhone: { flex: 1, minWidth: 120 },
  cellDate: { flex: 1, minWidth: 100 },
  cellRole: { flex: 1, minWidth: 150, position: 'relative' },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  roleButtonText: { fontFamily: fonts.uiSemiBold, fontSize: 13 },
  roleChevron: { fontSize: 10, color: colors.textSecondary },
  roleMenu: {
    position: 'absolute',
    top: 40,
    left: 0,
    zIndex: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  roleMenuItem: { paddingHorizontal: 14, paddingVertical: 8 },
  roleMenuText: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.azulNexo },
  roleMenuActive: { fontFamily: fonts.uiSemiBold, color: colors.textAccent },
});
