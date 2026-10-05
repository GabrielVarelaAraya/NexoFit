import { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Button, Card, Input, LoadingView } from '../../components/ui';
import {
  usePayments,
  formatMoney,
  formatShortDate,
  METHOD_LABELS,
  STATUS_LABELS,
  type PaymentMethod,
} from '../../hooks/usePayments';
import { useOrgMembers } from '../../hooks/useAdmin';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'Payments'>;
type Tab = 'historial' | 'planes';

const METHODS: PaymentMethod[] = ['cash', 'transfer', 'card', 'other'];
const CURRENCIES = ['USD', 'CRC', 'EUR'];

export function PaymentsScreen({ navigation }: Props) {
  const { user, membership } = useAuth();
  const orgId = membership?.organization_id ?? '';
  const insets = useSafeAreaInsets();

  const {
    payments,
    plans,
    monthRevenueCents,
    monthCurrency,
    monthCount,
    loading,
    error,
    registerPayment,
    createPlan,
    archivePlan,
  } = usePayments(orgId);
  const { members } = useOrgMembers(orgId);

  const [tab, setTab] = useState<Tab>('historial');

  // Registrar pago.
  const [formOpen, setFormOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Crear plan.
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planCurrency, setPlanCurrency] = useState('USD');
  const [planDays, setPlanDays] = useState('30');
  const [planDesc, setPlanDesc] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  const selectedMember = members.find((m) => m.profileId === memberId) ?? null;

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => (m.fullName ?? '').toLowerCase().includes(q));
  }, [members, search]);

  const monthLabel = new Date().toLocaleDateString('es-CR', {
    month: 'long',
    year: 'numeric',
  });

  const resetPaymentForm = () => {
    setFormOpen(false);
    setMemberId(null);
    setPlanId(null);
    setMethod('cash');
    setAmount('');
    setNotes('');
    setSearch('');
  };

  const togglePlan = (id: string) => {
    if (planId === id) {
      setPlanId(null);
      return;
    }
    setPlanId(id);
    const plan = plans.find((p) => p.id === id);
    if (plan) setAmount((plan.priceCents / 100).toString());
  };

  const handleRegister = async () => {
    if (!selectedMember) {
      Alert.alert('Faltan datos', 'Selecciona el miembro que realiza el pago.');
      return;
    }
    const parsed = Number(amount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      Alert.alert('Error', 'El monto debe ser un número válido (mínimo 0).');
      return;
    }

    const plan = plans.find((p) => p.id === planId) ?? null;
    setSaving(true);
    const result = await registerPayment({
      organizationId: orgId,
      profileId: selectedMember.profileId,
      planId: plan?.id ?? null,
      amountCents: Math.round(parsed * 100),
      currency: plan?.currency ?? 'USD',
      method,
      notes,
      createdBy: user?.id ?? null,
    });
    setSaving(false);

    if (!result.success) {
      Alert.alert('Error', result.error ?? 'No se pudo registrar el pago.');
      return;
    }

    resetPaymentForm();
    Alert.alert(
      'Pago registrado',
      `Se registró el pago de ${selectedMember.fullName ?? 'miembro'}.`
    );
  };

  const resetPlanForm = () => {
    setPlanFormOpen(false);
    setPlanName('');
    setPlanPrice('');
    setPlanCurrency('USD');
    setPlanDays('30');
    setPlanDesc('');
  };

  const handleCreatePlan = async () => {
    const name = planName.trim();
    if (!name) {
      Alert.alert('Faltan datos', 'Escribe un nombre para el plan.');
      return;
    }
    const price = Number(planPrice.replace(',', '.'));
    if (!Number.isFinite(price) || price < 0) {
      Alert.alert('Error', 'El precio debe ser un número válido (mínimo 0).');
      return;
    }
    const days = Number(planDays);
    if (!Number.isInteger(days) || days <= 0) {
      Alert.alert('Error', 'La duración debe ser un número entero de días (mínimo 1).');
      return;
    }

    setSavingPlan(true);
    const result = await createPlan({
      organizationId: orgId,
      name,
      description: planDesc,
      priceCents: Math.round(price * 100),
      currency: planCurrency,
      durationDays: days,
    });
    setSavingPlan(false);

    if (!result.success) {
      Alert.alert('Error', result.error ?? 'No se pudo crear el plan.');
      return;
    }
    resetPlanForm();
    Alert.alert('Plan creado', `El plan "${name}" ya está disponible.`);
  };

  const handleArchive = (id: string, name: string) => {
    Alert.alert('Archivar plan', `¿Archivar "${name}"? Los pagos registrados lo conservan.`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, archivar',
        style: 'destructive',
        onPress: async () => {
          const result = await archivePlan(id);
          if (!result.success) Alert.alert('Error', result.error ?? 'No se pudo archivar.');
        },
      },
    ]);
  };

  if (!orgId) {
    return (
      <View style={styles.container}>
        <Header
          title="Pagos"
          leftAction={{ label: '← Volver', onPress: () => navigation.goBack() }}
        />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Sin organización</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Pagos"
        subtitle="Historial, planes y cobros"
        leftAction={{ label: '← Volver', onPress: () => navigation.goBack() }}
      />

      {/* Selector de pestaña */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'historial' && styles.tabActive]}
          onPress={() => setTab('historial')}
        >
          <Text style={[styles.tabText, tab === 'historial' && styles.tabTextActive]}>
            Historial
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'planes' && styles.tabActive]}
          onPress={() => setTab('planes')}
        >
          <Text style={[styles.tabText, tab === 'planes' && styles.tabTextActive]}>Planes</Text>
        </TouchableOpacity>
      </View>

      {loading && payments.length === 0 && plans.length === 0 ? (
        <LoadingView label="Cargando pagos…" />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error && <Text style={styles.error}>{error}</Text>}

          {tab === 'historial' ? (
            <>
              {/* Resumen del mes */}
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Ingresos de {monthLabel}</Text>
                <Text style={styles.revenueValue}>
                  {formatMoney(monthRevenueCents, monthCurrency)}
                </Text>
                <Text style={styles.revenueHint}>
                  {monthCount === 1 ? '1 pago este mes' : `${monthCount} pagos este mes`}
                </Text>
              </Card>

              {/* Formulario / alta de pago */}
              {formOpen ? (
                <Card style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Registrar pago</Text>

                  <Text style={styles.fieldLabel}>Miembro</Text>
                  <TouchableOpacity
                    style={styles.selector}
                    onPress={() => {
                      setSearch('');
                      setPickerOpen(true);
                    }}
                  >
                    <Text style={selectedMember ? styles.selectorText : styles.selectorPlaceholder}>
                      {selectedMember?.fullName ?? 'Seleccionar miembro'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.fieldLabel}>Plan (opcional)</Text>
                  {plans.filter((p) => p.active).length === 0 ? (
                    <Text style={styles.hint}>
                      No hay planes activos. Créalos en la pestaña Planes.
                    </Text>
                  ) : (
                    <View style={styles.chips}>
                      {plans
                        .filter((p) => p.active)
                        .map((p) => (
                          <TouchableOpacity
                            key={p.id}
                            style={[styles.chip, planId === p.id && styles.chipActive]}
                            onPress={() => togglePlan(p.id)}
                          >
                            <Text
                              style={[styles.chipText, planId === p.id && styles.chipTextActive]}
                            >
                              {p.name} · {formatMoney(p.priceCents, p.currency)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>Método</Text>
                  <View style={styles.chips}>
                    {METHODS.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.chip, method === m && styles.chipActive]}
                        onPress={() => setMethod(m)}
                      >
                        <Text style={[styles.chipText, method === m && styles.chipTextActive]}>
                          {METHOD_LABELS[m]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Input
                    label="Monto"
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                  <Input
                    label="Notas (opcional)"
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Ej. Pago de octubre en efectivo"
                  />

                  <Button
                    title="Registrar pago"
                    fullWidth
                    loading={saving}
                    onPress={handleRegister}
                  />
                  <Button title="Cancelar" variant="ghost" fullWidth onPress={resetPaymentForm} />
                </Card>
              ) : (
                <Button title="Registrar pago" fullWidth onPress={() => setFormOpen(true)} />
              )}

              {/* Historial */}
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Últimos pagos</Text>
                {payments.length === 0 ? (
                  <Text style={styles.hint}>
                    Aún no hay pagos registrados. El primer cobro aparecerá aquí.
                  </Text>
                ) : (
                  payments.map((p) => (
                    <View key={p.id} style={styles.paymentRow}>
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentMember}>{p.memberName ?? 'Miembro'}</Text>
                        <Text style={styles.paymentMeta}>
                          {[p.planName, METHOD_LABELS[p.method as PaymentMethod] ?? p.method]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                      <View style={styles.paymentRight}>
                        <Text style={styles.paymentAmount}>
                          {formatMoney(p.amountCents, p.currency)}
                        </Text>
                        <Text style={styles.paymentDate}>
                          {formatShortDate(p.paidAt)}
                          {p.status !== 'paid' ? ` · ${STATUS_LABELS[p.status] ?? p.status}` : ''}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </Card>
            </>
          ) : (
            <>
              {/* Crear plan */}
              {planFormOpen ? (
                <Card style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Nuevo plan</Text>
                  <Input
                    label="Nombre"
                    value={planName}
                    onChangeText={setPlanName}
                    placeholder="Ej. Plan mensual"
                    maxLength={40}
                  />
                  <Input
                    label="Precio"
                    value={planPrice}
                    onChangeText={setPlanPrice}
                    placeholder="25.00"
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.fieldLabel}>Moneda</Text>
                  <View style={styles.chips}>
                    {CURRENCIES.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.chip, planCurrency === c && styles.chipActive]}
                        onPress={() => setPlanCurrency(c)}
                      >
                        <Text
                          style={[styles.chipText, planCurrency === c && styles.chipTextActive]}
                        >
                          {c}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Input
                    label="Duración (días)"
                    value={planDays}
                    onChangeText={setPlanDays}
                    placeholder="30"
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <Input
                    label="Descripción (opcional)"
                    value={planDesc}
                    onChangeText={setPlanDesc}
                    placeholder="Ej. Acceso ilimitado a clases grupales"
                    maxLength={120}
                  />
                  <Button
                    title="Crear plan"
                    fullWidth
                    loading={savingPlan}
                    onPress={handleCreatePlan}
                  />
                  <Button title="Cancelar" variant="ghost" fullWidth onPress={resetPlanForm} />
                </Card>
              ) : (
                <Button title="Nuevo plan" fullWidth onPress={() => setPlanFormOpen(true)} />
              )}

              {/* Listado de planes */}
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Planes de membresía</Text>
                {plans.length === 0 ? (
                  <Text style={styles.hint}>
                    No hay planes todavía. Crea el primero para poder registrar pagos ligados a él.
                  </Text>
                ) : (
                  plans.map((p) => (
                    <View key={p.id} style={styles.planRow}>
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentMember}>
                          {p.name} {!p.active && '· Archivado'}
                        </Text>
                        <Text style={styles.paymentMeta}>
                          {formatMoney(p.priceCents, p.currency)} · {p.durationDays} días
                          {p.description ? ` · ${p.description}` : ''}
                        </Text>
                      </View>
                      {p.active && (
                        <TouchableOpacity onPress={() => handleArchive(p.id, p.name)}>
                          <Text style={styles.archiveText}>Archivar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </Card>
            </>
          )}
        </ScrollView>
      )}

      {/* Selector de miembro */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: 16 + insets.bottom }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar miembro</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por nombre…"
              autoCapitalize="none"
            />
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {filteredMembers.length === 0 ? (
                <Text style={styles.hint}>Sin miembros que coincidan.</Text>
              ) : (
                filteredMembers.map((m) => (
                  <TouchableOpacity
                    key={m.profileId}
                    style={[styles.memberRow, memberId === m.profileId && styles.memberRowActive]}
                    onPress={() => {
                      setMemberId(m.profileId);
                      setPickerOpen(false);
                    }}
                  >
                    <Text style={styles.memberName}>{m.fullName ?? 'Sin nombre'}</Text>
                    <Text style={styles.memberMeta}>{m.role}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  tabs: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.white },
  tabText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: '#6B7280',
  },
  tabTextActive: { color: colors.azulNexo },
  content: { padding: 16, gap: 16 },
  sectionCard: { gap: 12 },
  sectionTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.azulNexo,
  },
  fieldLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.azulNexo,
  },
  revenueValue: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 32,
    color: colors.azulNexo,
  },
  revenueHint: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#6B7280',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: colors.white,
    borderColor: '#D1D5DB',
  },
  chipActive: { backgroundColor: colors.azulNexo, borderColor: colors.azulNexo },
  chipText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.azulNexo,
  },
  chipTextActive: { color: colors.crema },
  selector: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectorText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: '#111827',
  },
  selectorPlaceholder: {
    fontFamily: fonts.uiRegular,
    fontSize: 16,
    color: '#9CA3AF',
  },
  hint: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  error: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#EF4444',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  paymentInfo: { flex: 1, gap: 2 },
  paymentMember: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    color: colors.azulNexo,
  },
  paymentMeta: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: '#6B7280',
  },
  paymentRight: { alignItems: 'flex-end', gap: 2 },
  paymentAmount: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    color: colors.azulNexo,
  },
  paymentDate: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: '#9CA3AF',
  },
  archiveText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: '#E74C3C',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 17,
    color: colors.azulNexo,
  },
  modalClose: {
    fontSize: 18,
    color: '#6B7280',
    paddingHorizontal: 8,
  },
  modalList: { flexGrow: 0 },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  memberRowActive: { backgroundColor: '#E8F7F5' },
  memberName: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    color: colors.azulNexo,
    flexShrink: 1,
  },
  memberMeta: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
});
