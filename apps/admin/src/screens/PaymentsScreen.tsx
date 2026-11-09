import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@nexofit/core';
import { Badge, Card, EmptyState, ErrorText, LoadingView, StatCard } from '../components/ui';
import { usePayments, type PaymentItem } from '../hooks/useAdminData';
import { METHOD_LABELS, STATUS_LABELS, formatMoney, formatShortDate } from '../utils/format';

const STATUS_COLORS: Record<string, string> = {
  paid: colors.success,
  pending: '#F5A623',
  refunded: colors.textSecondary,
};

// Texto en tonos oscuros: sobre la píldora teñida (12% del color) mantiene
// contraste AA (4.5:1); usar el color crudo queda en ~2:1.
const STATUS_TEXT_COLORS: Record<string, string> = {
  paid: colors.textSuccess,
  pending: colors.textWarning,
  refunded: colors.textSecondary,
};

// Historial de cobros e ingresos del mes (ledger de payments, Stage 5).
export function PaymentsScreen({ organizationId }: { organizationId: string }) {
  const { payments, monthCount, monthRevenueCents, monthCurrency, loading, error } =
    usePayments(organizationId);

  if (loading) return <LoadingView label="Cargando pagos…" />;

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Pagos</Text>

      {error && <ErrorText>{error}</ErrorText>}

      <View style={styles.statsRow}>
        <StatCard
          label="Ingresos cobrados del mes"
          value={formatMoney(monthRevenueCents, monthCurrency)}
        />
        <StatCard label="Pagos registrados del mes" value={String(monthCount)} />
      </View>

      <Card style={styles.table}>
        <Text style={styles.sectionTitle}>Historial reciente (últimos 50)</Text>

        {payments.length === 0 ? (
          <EmptyState
            title="Sin pagos registrados."
            subtitle="Registra cobros desde la app móvil en «Pagos»."
          />
        ) : (
          <View>
            <View style={[styles.row, styles.headerTableRow]}>
              <Text style={[styles.cellDate, styles.headerText]}>Fecha</Text>
              <Text style={[styles.cellName, styles.headerText]}>Miembro</Text>
              <Text style={[styles.cellPlan, styles.headerText]}>Plan</Text>
              <Text style={[styles.cellMethod, styles.headerText]}>Método</Text>
              <Text style={[styles.cellAmount, styles.headerText]}>Monto</Text>
              <Text style={[styles.cellStatus, styles.headerText]}>Estado</Text>
            </View>
            {payments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

function PaymentRow({ payment }: { payment: PaymentItem }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.cellText, styles.cellDate]}>{formatShortDate(payment.paidAt)}</Text>
      <Text style={[styles.cellText, styles.cellName]}>{payment.memberName ?? '—'}</Text>
      <Text style={[styles.cellText, styles.cellPlan]}>{payment.planName ?? '—'}</Text>
      <Text style={[styles.cellText, styles.cellMethod]}>
        {METHOD_LABELS[payment.method as keyof typeof METHOD_LABELS] ?? payment.method}
      </Text>
      <Text style={[styles.cellText, styles.cellAmount]}>
        {formatMoney(payment.amountCents, payment.currency)}
      </Text>
      <View style={styles.cellStatus}>
        <Badge
          label={STATUS_LABELS[payment.status] ?? payment.status}
          color={STATUS_COLORS[payment.status] ?? colors.turquesa}
          textColor={STATUS_TEXT_COLORS[payment.status] ?? colors.azulNexo}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  h1: { fontFamily: fonts.brand, fontSize: 26, color: colors.azulNexo },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  table: { gap: 12 },
  sectionTitle: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.azulNexo },
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
  cellText: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.azulNexo },
  cellDate: { flex: 1, minWidth: 100 },
  cellName: { flex: 2, minWidth: 140 },
  cellPlan: { flex: 1, minWidth: 110 },
  cellMethod: { flex: 1, minWidth: 100 },
  cellAmount: { flex: 1, minWidth: 90, fontFamily: fonts.uiSemiBold },
  cellStatus: { flex: 1, minWidth: 110 },
});
