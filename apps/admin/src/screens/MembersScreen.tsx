import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, fonts, type RoleType } from '@nexofit/core';
import {
  Badge,
  Card,
  ConfirmModal,
  EmptyState,
  ErrorText,
  FilterChips,
  LoadingView,
  SidePanel,
  TableSkeleton,
  useNarrow,
  FadeIn,
} from '../components/ui';
import { useMemberDetail, useOrgMembers, type OrgMember } from '../hooks/useAdminData';
import type { ScreenProps } from '../app/router';
import { METHOD_LABELS, formatMoney, formatRelative, formatShortDate } from '../utils/format';
import {
  ROLE_FILTERS,
  countByRole,
  filterMembers,
  parseRoleFilter,
  type RoleFilter,
} from '../utils/members';

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

// Miembros del gimnasio: filtros por rol, búsqueda y panel de detalle.
// Búsqueda, filtro y miembro abierto viven en la URL (?q=&rol=&m=) para
// poder compartir el enlace y volver con el botón atrás.
export function MembersScreen({ organizationId, navigate, params, currentUserId }: ScreenProps) {
  const { members, loading, error, updateRole } = useOrgMembers(organizationId);
  const narrow = useNarrow();
  const [query, setQuery] = useState(params.q ?? '');
  const role = parseRoleFilter(params.rol);
  const selected = members.find((m) => m.membershipId === params.m) ?? null;
  const [pendingRole, setPendingRole] = useState<{ member: OrgMember; role: RoleType } | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const counts = useMemo(() => countByRole(members), [members]);
  const filtered = useMemo(() => filterMembers(members, query, role), [members, query, role]);

  const setParams = (next: Partial<Record<'q' | 'rol' | 'm', string>>, replace = true) =>
    navigate(
      'members',
      { q: query, rol: role === 'all' ? '' : role, m: params.m ?? '', ...next },
      replace
    );

  const applyRole = async () => {
    if (!pendingRole) return;
    setSaving(true);
    setRoleError(null);
    const result = await updateRole(pendingRole.member.membershipId, pendingRole.role);
    setSaving(false);
    setPendingRole(null);
    if (!result.success) setRoleError(result.error ?? 'No se pudo cambiar el rol.');
  };

  if (loading) return <TableSkeleton label="Cargando miembros" />;

  return (
    <FadeIn>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.h1}>Miembros</Text>
          <TextInput
            style={[styles.search, narrow && styles.searchNarrow]}
            placeholder="Buscar por nombre o teléfono…"
            placeholderTextColor={colors.textPlaceholder}
            accessibilityLabel="Buscar miembros"
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setParams({ q: text });
            }}
          />
        </View>

        <FilterChips<RoleFilter>
          label="Filtrar por rol"
          value={role}
          onChange={(value) => setParams({ rol: value === 'all' ? '' : value })}
          options={ROLE_FILTERS.map((option) => ({
            value: option.value,
            label: `${option.label} (${counts[option.value]})`,
          }))}
        />

        {error && <ErrorText>{error}</ErrorText>}
        {roleError && <ErrorText>{roleError}</ErrorText>}

        <Card style={styles.table}>
          {!narrow && (
            <View style={[styles.row, styles.headerTableRow]}>
              <Text style={[styles.cellName, styles.headerText]}>Miembro</Text>
              <Text style={[styles.cellPhone, styles.headerText]}>Teléfono</Text>
              <Text style={[styles.cellDate, styles.headerText]}>Alta</Text>
              <Text style={[styles.cellRole, styles.headerText]}>Rol</Text>
            </View>
          )}

          {filtered.length === 0 ? (
            // La búsqueda vacía no significa que la organización no tenga miembros.
            query.trim() || role !== 'all' ? (
              <EmptyState
                title="Sin resultados"
                subtitle="Ningún miembro coincide con la búsqueda o el filtro."
              />
            ) : (
              <EmptyState
                title="Sin miembros"
                subtitle="Aún no hay miembros en esta organización."
              />
            )
          ) : (
            filtered.map((member) => (
              <TouchableOpacity
                key={member.membershipId}
                style={[styles.row, narrow && styles.rowNarrow]}
                onPress={() => setParams({ m: member.membershipId }, false)}
                accessibilityRole="button"
                accessibilityLabel={`Ver detalle de ${member.fullName}`}
                activeOpacity={0.7}
              >
                <Text style={[styles.cellText, styles.cellName, styles.nameText]}>
                  {member.fullName}
                </Text>
                <Text style={[styles.cellText, styles.cellPhone]}>
                  {member.phone ?? (narrow ? 'Sin teléfono' : '—')}
                </Text>
                <Text style={[styles.cellText, styles.cellDate]}>
                  {narrow ? 'Alta: ' : ''}
                  {formatShortDate(member.createdAt)}
                </Text>
                <View style={styles.cellRole}>
                  <Badge label={ROLE_LABELS[member.role]} color={ROLE_COLORS[member.role]} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </Card>

        <SidePanel
          visible={selected !== null}
          title={selected?.fullName ?? ''}
          onClose={() => setParams({ m: '' }, false)}
        >
          {selected && (
            <MemberPanel
              organizationId={organizationId}
              member={selected}
              isSelf={selected.profileId === currentUserId}
              onChangeRole={(next) => setPendingRole({ member: selected, role: next })}
            />
          )}
        </SidePanel>

        <ConfirmModal
          visible={pendingRole !== null}
          title={pendingRole ? `Cambiar a ${ROLE_LABELS[pendingRole.role]}` : ''}
          message={
            pendingRole
              ? pendingRole.role === 'admin'
                ? `${pendingRole.member.fullName} tendrá acceso total a la consola, pagos y miembros. Se aplica de inmediato.`
                : `${pendingRole.member.fullName} pasará a ser ${ROLE_LABELS[pendingRole.role].toLowerCase()}. Se aplica de inmediato.`
              : ''
          }
          confirmLabel="Cambiar rol"
          destructive={pendingRole?.role === 'admin'}
          busy={saving}
          onConfirm={() => void applyRole()}
          onCancel={() => setPendingRole(null)}
        />
      </View>
    </FadeIn>
  );
}

function MemberPanel({
  organizationId,
  member,
  isSelf,
  onChangeRole,
}: {
  organizationId: string;
  member: OrgMember;
  isSelf: boolean;
  onChangeRole: (role: RoleType) => void;
}) {
  const { detail, loading, error } = useMemberDetail(organizationId, member.profileId);

  return (
    <>
      <Card style={styles.panelCard}>
        <InfoRow label="Teléfono" value={member.phone ?? 'Sin registrar'} />
        <InfoRow label="Miembro desde" value={formatShortDate(member.createdAt)} />
        <InfoRow label="Rol" value={ROLE_LABELS[member.role]} />
      </Card>

      <Card style={styles.panelCard}>
        <Text style={styles.panelTitle}>Cambiar rol</Text>
        {isSelf ? (
          // Igual que en la app móvil: un admin no puede quitarse su propio acceso.
          <Text style={styles.muted}>Es tu cuenta: otro administrador debe cambiar tu rol.</Text>
        ) : (
          <View style={styles.roleOptions}>
            {ALL_ROLES.map((option) => {
              const current = option === member.role;
              return (
                <TouchableOpacity
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current, disabled: current }}
                  disabled={current}
                  style={[styles.roleOption, current && styles.roleOptionCurrent]}
                  onPress={() => onChangeRole(option)}
                >
                  <Text style={[styles.roleOptionText, current && styles.roleOptionTextCurrent]}>
                    {ROLE_LABELS[option]}
                    {current ? ' · actual' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </Card>

      <Card style={styles.panelCard}>
        <Text style={styles.panelTitle}>Actividad (30 días)</Text>
        {loading ? (
          <LoadingView label="Cargando…" />
        ) : error ? (
          <ErrorText>{error}</ErrorText>
        ) : detail ? (
          <>
            <InfoRow label="Reservas" value={String(detail.bookings30d)} />
            <InfoRow label="Asistencias marcadas" value={String(detail.attended30d)} />
            <InfoRow
              label="Última reserva"
              value={detail.lastBookingAt ? formatRelative(detail.lastBookingAt) : 'Sin reservas'}
            />
          </>
        ) : null}
      </Card>

      <Card style={styles.panelCard}>
        <Text style={styles.panelTitle}>Últimos pagos</Text>
        {detail && detail.payments.length === 0 && (
          <Text style={styles.muted}>Sin pagos registrados.</Text>
        )}
        {detail?.payments.map((payment) => (
          <View key={payment.id} style={styles.paymentRow}>
            <Text style={styles.cellText}>{formatShortDate(payment.paidAt)}</Text>
            <Text style={styles.muted}>
              {payment.planName ?? 'Sin plan'} ·{' '}
              {METHOD_LABELS[payment.method as keyof typeof METHOD_LABELS] ?? payment.method}
            </Text>
            <Text style={styles.amount}>{formatMoney(payment.amountCents, payment.currency)}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
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
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 280,
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.azulNexo,
  },
  searchNarrow: { minWidth: 0, width: '100%' },
  table: { padding: 8, gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
    gap: 12,
  },
  // Angosto: cada miembro es una tarjeta apilada en vez de una fila con columnas.
  rowNarrow: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  headerTableRow: { borderBottomWidth: 1, borderBottomColor: colors.border },
  headerText: { fontFamily: fonts.uiSemiBold, fontSize: 12, color: colors.textSecondary },
  cellText: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.azulNexo },
  nameText: { fontFamily: fonts.uiSemiBold },
  cellName: { flex: 2, minWidth: 160 },
  cellPhone: { flex: 1, minWidth: 120 },
  cellDate: { flex: 1, minWidth: 100 },
  cellRole: { flex: 1, minWidth: 130 },
  panelCard: { gap: 10, padding: 16 },
  panelTitle: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: colors.azulNexo },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  infoValue: { fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.azulNexo },
  muted: { fontFamily: fonts.uiRegular, fontSize: 13, color: colors.textSecondary },
  roleOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  roleOptionCurrent: { backgroundColor: colors.surfaceSubtle },
  roleOptionText: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.azulNexo },
  roleOptionTextCurrent: { color: colors.textSecondary },
  paymentRow: {
    gap: 2,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
  },
  amount: { fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.azulNexo },
});
