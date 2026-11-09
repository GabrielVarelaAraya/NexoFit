import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, fonts, shouldShowSkeleton, useHasLoaded } from '@nexofit/core';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  FilterChips,
  SidePanel,
  StatCard,
  TableSkeleton,
  useNarrow,
  FadeIn,
} from '../components/ui';
import { useOrgMembers, usePayments, type PaymentItem } from '../hooks/useAdminData';
import type { ScreenProps } from '../app/router';
import {
  METHOD_LABELS,
  STATUS_LABELS,
  formatMoney,
  formatShortDate,
  toCsv,
  type PaymentMethod,
} from '../utils/format';
import {
  filterPayments,
  parseAmountToCents,
  type MethodFilter,
  type StatusFilter,
} from '../utils/payments';

const STATUS_COLORS: Record<string, string> = {
  paid: colors.success,
  pending: colors.warning,
  refunded: colors.textSecondary,
};

// Texto en tonos oscuros: sobre la píldora teñida (12% del color) mantiene
// contraste AA (4.5:1); usar el color crudo queda en ~2:1.
const STATUS_TEXT_COLORS: Record<string, string> = {
  paid: colors.textSuccess,
  pending: colors.textWarning,
  refunded: colors.textSecondary,
};

const STATUS_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'paid', label: 'Pagados' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'refunded', label: 'Reembolsados' },
];

const METHODS = Object.keys(METHOD_LABELS) as PaymentMethod[];

const METHOD_OPTIONS: readonly { value: MethodFilter; label: string }[] = [
  { value: 'all', label: 'Todos los métodos' },
  ...METHODS.map((method) => ({ value: method, label: METHOD_LABELS[method] })),
];

// Historial de cobros, ingresos del mes y registro de pagos (antes solo
// lectura: había que ir a la app móvil para registrar un cobro).
export function PaymentsScreen({ organizationId, navigate, params, currentUserId }: ScreenProps) {
  const data = usePayments(organizationId);
  const hasLoaded = useHasLoaded(data.loading);
  const narrow = useNarrow();
  const status = (STATUS_OPTIONS.find((o) => o.value === params.estado)?.value ??
    'all') as StatusFilter;
  const method = (METHOD_OPTIONS.find((o) => o.value === params.metodo)?.value ??
    'all') as MethodFilter;
  const [query, setQuery] = useState('');
  const registering = params.nuevo === '1';

  const filtered = useMemo(
    () => filterPayments(data.payments, status, method, query),
    [data.payments, status, method, query]
  );

  const setFilter = (
    next: Partial<Record<'estado' | 'metodo' | 'nuevo', string>>,
    replace = true
  ) =>
    navigate(
      'payments',
      {
        estado: status === 'all' ? '' : status,
        metodo: method === 'all' ? '' : method,
        nuevo: registering ? '1' : '',
        ...next,
      },
      replace
    );

  const exportCsv = () => {
    const csv = toCsv([
      ['Fecha', 'Miembro', 'Plan', 'Método', 'Monto', 'Moneda', 'Estado'],
      ...filtered.map((p) => [
        formatShortDate(p.paidAt),
        p.memberName ?? '',
        p.planName ?? '',
        METHOD_LABELS[p.method as PaymentMethod] ?? p.method,
        (p.amountCents / 100).toFixed(2),
        p.currency,
        STATUS_LABELS[p.status] ?? p.status,
      ]),
    ]);
    if (Platform.OS !== 'web') return;
    // BOM para que Excel abra bien las tildes.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pagos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (shouldShowSkeleton(data.loading, hasLoaded) && data.payments.length === 0) {
    return <TableSkeleton label="Cargando pagos" />;
  }

  return (
    <FadeIn>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.h1}>Pagos</Text>
          <View style={styles.headerActions}>
            <Button
              label="Exportar CSV"
              variant="ghost"
              onPress={exportCsv}
              disabled={filtered.length === 0}
            />
            <Button label="Registrar pago" onPress={() => setFilter({ nuevo: '1' }, false)} />
          </View>
        </View>

        {data.error && <ErrorText>{data.error}</ErrorText>}

        <View style={styles.statsRow}>
          <StatCard
            label="Ingresos cobrados del mes"
            value={formatMoney(data.monthRevenueCents, data.monthCurrency)}
          />
          <StatCard label="Pagos registrados del mes" value={String(data.monthCount)} />
        </View>

        <Card style={styles.table}>
          <View style={styles.filters}>
            <Text style={styles.sectionTitle}>Historial reciente (últimos 50)</Text>
            <TextInput
              style={[styles.search, narrow && styles.searchNarrow]}
              placeholder="Buscar miembro…"
              placeholderTextColor={colors.textPlaceholder}
              accessibilityLabel="Buscar pagos por miembro"
              value={query}
              onChangeText={setQuery}
            />
          </View>
          <FilterChips<StatusFilter>
            label="Filtrar por estado"
            value={status}
            onChange={(value) => setFilter({ estado: value === 'all' ? '' : value })}
            options={STATUS_OPTIONS}
          />
          <FilterChips<MethodFilter>
            label="Filtrar por método"
            value={method}
            onChange={(value) => setFilter({ metodo: value === 'all' ? '' : value })}
            options={METHOD_OPTIONS}
          />

          {filtered.length === 0 ? (
            data.payments.length === 0 ? (
              <EmptyState
                title="Sin pagos registrados"
                subtitle="Usa «Registrar pago» cuando un miembro pague en recepción."
              />
            ) : (
              <EmptyState title="Sin resultados" subtitle="Ningún pago coincide con los filtros." />
            )
          ) : (
            <View>
              {!narrow && (
                <View style={[styles.row, styles.headerTableRow]}>
                  <Text style={[styles.cellDate, styles.headerText]}>Fecha</Text>
                  <Text style={[styles.cellName, styles.headerText]}>Miembro</Text>
                  <Text style={[styles.cellPlan, styles.headerText]}>Plan</Text>
                  <Text style={[styles.cellMethod, styles.headerText]}>Método</Text>
                  <Text style={[styles.cellAmount, styles.headerText]}>Monto</Text>
                  <Text style={[styles.cellStatus, styles.headerText]}>Estado</Text>
                </View>
              )}
              {filtered.map((payment) => (
                <PaymentRow key={payment.id} payment={payment} narrow={narrow} />
              ))}
            </View>
          )}
        </Card>

        <SidePanel
          visible={registering}
          title="Registrar pago"
          onClose={() => setFilter({ nuevo: '' }, false)}
        >
          {registering && (
            <RegisterPaymentForm
              organizationId={organizationId}
              data={data}
              createdBy={currentUserId}
              onDone={() => setFilter({ nuevo: '' }, false)}
            />
          )}
        </SidePanel>
      </View>
    </FadeIn>
  );
}

function RegisterPaymentForm({
  organizationId,
  data,
  createdBy,
  onDone,
}: {
  organizationId: string;
  data: ReturnType<typeof usePayments>;
  createdBy: string;
  onDone: () => void;
}) {
  const { members } = useOrgMembers(organizationId);
  const [memberQuery, setMemberQuery] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = data.plans.find((p) => p.id === planId) ?? null;
  const member = members.find((m) => m.profileId === profileId) ?? null;
  const matches = memberQuery.trim()
    ? members
        .filter((m) => m.fullName.toLowerCase().includes(memberQuery.trim().toLowerCase()))
        .slice(0, 6)
    : [];
  const cents = parseAmountToCents(amount);

  const choosePlan = (id: string | null) => {
    setPlanId(id);
    const chosen = data.plans.find((p) => p.id === id);
    // El monto se completa con el precio del plan; se puede ajustar.
    if (chosen) setAmount(String(chosen.priceCents / 100));
  };

  const submit = async () => {
    if (!profileId) return setError('Elige a quién corresponde el pago.');
    if (cents == null) return setError('Escribe un monto válido mayor que 0.');
    setSaving(true);
    setError(null);
    const result = await data.registerPayment({
      profileId,
      planId,
      amountCents: cents,
      currency: plan?.currency ?? data.monthCurrency ?? 'CRC',
      method,
      notes,
      createdBy,
    });
    setSaving(false);
    if (!result.success) return setError(result.error ?? 'No se pudo registrar el pago.');
    onDone();
  };

  return (
    <View style={styles.form}>
      <View style={styles.formBlock}>
        <Text style={styles.formLabel}>Miembro</Text>
        {member ? (
          <View style={styles.selected}>
            <Text style={styles.selectedText}>{member.fullName}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => setProfileId(null)}>
              <Text style={styles.link}>Cambiar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.search}
              placeholder="Escribe el nombre…"
              placeholderTextColor={colors.textPlaceholder}
              accessibilityLabel="Buscar miembro para el pago"
              value={memberQuery}
              onChangeText={setMemberQuery}
            />
            {matches.map((m) => (
              <TouchableOpacity
                key={m.membershipId}
                accessibilityRole="button"
                style={styles.option}
                onPress={() => {
                  setProfileId(m.profileId);
                  setMemberQuery('');
                }}
              >
                <Text style={styles.selectedText}>{m.fullName}</Text>
              </TouchableOpacity>
            ))}
            {memberQuery.trim() !== '' && matches.length === 0 && (
              <Text style={styles.muted}>No hay miembros con ese nombre.</Text>
            )}
          </>
        )}
      </View>

      <View style={styles.formBlock}>
        <Text style={styles.formLabel}>Plan</Text>
        <FilterChips<string>
          label="Plan"
          value={planId ?? 'none'}
          onChange={(value) => choosePlan(value === 'none' ? null : value)}
          options={[
            { value: 'none', label: 'Sin plan' },
            ...data.plans.map((p) => ({
              value: p.id,
              label: `${p.name} · ${formatMoney(p.priceCents, p.currency)}`,
            })),
          ]}
        />
        {plan && <Text style={styles.muted}>Vigencia: {plan.durationDays} días desde hoy.</Text>}
      </View>

      <View style={styles.formBlock}>
        <Text style={styles.formLabel}>Método</Text>
        <FilterChips<PaymentMethod>
          label="Método de pago"
          value={method}
          onChange={setMethod}
          options={METHODS.map((m) => ({ value: m, label: METHOD_LABELS[m] }))}
        />
      </View>

      <Field
        label="Monto"
        value={amount}
        onChangeText={setAmount}
        placeholder="15 000"
        keyboardType="decimal-pad"
      />
      {amount !== '' && cents == null && (
        <Text style={styles.fieldError}>Escribe solo números (por ejemplo 15 000 o 15,50).</Text>
      )}
      <Field label="Notas (opcional)" value={notes} onChangeText={setNotes} />

      {error && <ErrorText>{error}</ErrorText>}

      <Button
        label={
          saving
            ? 'Registrando…'
            : cents != null
              ? `Registrar ${formatMoney(cents, plan?.currency ?? data.monthCurrency ?? 'CRC')}`
              : 'Registrar pago'
        }
        onPress={() => void submit()}
        disabled={saving}
      />
    </View>
  );
}

function PaymentRow({ payment, narrow }: { payment: PaymentItem; narrow: boolean }) {
  const badge = (
    <Badge
      label={STATUS_LABELS[payment.status] ?? payment.status}
      color={STATUS_COLORS[payment.status] ?? colors.turquesa}
      textColor={STATUS_TEXT_COLORS[payment.status] ?? colors.azulNexo}
    />
  );
  const methodLabel = METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method;

  if (narrow) {
    // Angosto: tarjeta apilada (antes la tabla cortaba Método/Monto/Estado).
    return (
      <View style={styles.cardRow}>
        <View style={styles.cardRowTop}>
          <Text style={[styles.cellText, styles.strong]}>{payment.memberName ?? '—'}</Text>
          <Text style={[styles.cellText, styles.strong]}>
            {formatMoney(payment.amountCents, payment.currency)}
          </Text>
        </View>
        <Text style={styles.muted}>
          {formatShortDate(payment.paidAt)} · {payment.planName ?? 'Sin plan'} · {methodLabel}
        </Text>
        {badge}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.cellText, styles.cellDate]}>{formatShortDate(payment.paidAt)}</Text>
      <Text style={[styles.cellText, styles.cellName]}>{payment.memberName ?? '—'}</Text>
      <Text style={[styles.cellText, styles.cellPlan]}>{payment.planName ?? '—'}</Text>
      <Text style={[styles.cellText, styles.cellMethod]}>{methodLabel}</Text>
      <Text style={[styles.cellText, styles.cellAmount]}>
        {formatMoney(payment.amountCents, payment.currency)}
      </Text>
      <View style={styles.cellStatus}>{badge}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerActions: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  h1: { fontFamily: fonts.brand, fontSize: 26, color: colors.azulNexo },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  table: { gap: 12 },
  filters: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionTitle: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.azulNexo },
  search: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 220,
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.azulNexo,
  },
  searchNarrow: { minWidth: 0, width: '100%' },
  headerTableRow: { borderBottomWidth: 1, borderBottomColor: colors.border },
  headerText: { fontFamily: fonts.uiSemiBold, fontSize: 12, color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
    gap: 12,
  },
  cardRow: {
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  cardRowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  strong: { fontFamily: fonts.uiSemiBold },
  cellText: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.azulNexo },
  cellDate: { flex: 1, minWidth: 100 },
  cellName: { flex: 2, minWidth: 140 },
  cellPlan: { flex: 1, minWidth: 110 },
  cellMethod: { flex: 1, minWidth: 100 },
  cellAmount: { flex: 1, minWidth: 90, fontFamily: fonts.uiSemiBold },
  cellStatus: { flex: 1, minWidth: 110 },
  muted: { fontFamily: fonts.uiRegular, fontSize: 13, color: colors.textSecondary },
  form: { gap: 18 },
  formBlock: { gap: 8 },
  formLabel: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.azulNexo },
  selected: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.textAccent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectedText: { fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.azulNexo },
  link: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.textAccent },
  option: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fieldError: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textError,
    marginTop: -10,
  },
});
