import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, getSupabase } from '@nexofit/core';
import { Header, Button, LoadingView } from '../../components/ui';
import { caughtError } from '../../utils/errors';
import { notify } from '../../utils/alerts';
import type { NavigationProp } from '../../types/screens';
import {
  BOOKING_HORIZON_DAYS,
  addDaysStr,
  bookAppointment,
  bookingStepNumber,
  missingStepHint,
  specialtyLabel,
  type BookingStep,
  fetchBusySlots,
  fetchProfessionalDirectory,
  fetchProfessionalOffer,
  formatGymDate,
  formatGymTime,
  gymDateParts,
  gymDateStr,
  gymSlotsForDate,
  type BusyRange,
  type DirectoryProfessional,
  type ProfessionalOffer,
  type TimeSlot,
} from '../../utils/appointments';

const DAY_MS = 24 * 60 * 60_000;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Option({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <Text style={styles.optionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.optionSubtitle}>{subtitle}</Text> : null}
    </Pressable>
  );
}

export function BookAppointmentScreen({ navigation }: { navigation: NavigationProp }) {
  const [directory, setDirectory] = useState<DirectoryProfessional[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const step = (name: BookingStep) => bookingStepNumber(name, directory.length > 1);
  const [offer, setOffer] = useState<ProfessionalOffer | null>(null);
  const [busy, setBusy] = useState<BusyRange[]>([]);
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const requestId = useRef(0);

  const loadBusy = useCallback(async (id: string) => {
    const now = new Date();
    const to = new Date(now.getTime() + (BOOKING_HORIZON_DAYS + 1) * DAY_MS);
    return fetchBusySlots(getSupabase(), id, now, to);
  }, []);

  const selectProfessional = useCallback(
    async (id: string) => {
      const request = ++requestId.current;
      setProfessionalId(id);
      setOffer(null);
      setBusy([]);
      setServiceId(null);
      setSelectedDate(null);
      setSelectedSlot(null);
      setOfferError(null);
      setOfferLoading(true);
      try {
        const [loadedOffer, loadedBusy] = await Promise.all([
          fetchProfessionalOffer(getSupabase(), id),
          loadBusy(id),
        ]);
        if (request !== requestId.current) return;
        setOffer(loadedOffer);
        setBusy(loadedBusy);
        if (loadedOffer.services.length === 1) setServiceId(loadedOffer.services[0].id);
      } catch (cause) {
        if (request === requestId.current) {
          setOfferError(caughtError(cause, 'No pudimos cargar los horarios de este profesional.'));
        }
      } finally {
        if (request === requestId.current) setOfferLoading(false);
      }
    },
    [loadBusy]
  );

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    setDirectoryError(null);
    try {
      const list = await fetchProfessionalDirectory(getSupabase());
      setDirectory(list);
      if (list.length === 1) void selectProfessional(list[0].professionalId);
    } catch (cause) {
      setDirectoryError(caughtError(cause, 'No pudimos cargar los profesionales.'));
    } finally {
      setDirectoryLoading(false);
    }
  }, [selectProfessional]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const dates = useMemo(() => {
    const today = gymDateStr(new Date());
    return Array.from({ length: BOOKING_HORIZON_DAYS }, (_, index) => addDaysStr(today, index));
  }, []);

  const service = offer?.services.find((item) => item.id === serviceId) ?? null;

  const slotsByDate = useMemo(() => {
    const result: Record<string, TimeSlot[]> = {};
    if (!offer || !service) return result;
    const now = new Date();
    for (const date of dates) {
      result[date] = gymSlotsForDate(offer.blocks, service.duration_minutes, date, now, busy);
    }
    return result;
  }, [offer, service, busy, dates]);

  const firstDateWithSlots = dates.find((date) => slotsByDate[date]?.length) ?? null;
  const activeDate =
    selectedDate && slotsByDate[selectedDate]?.length ? selectedDate : firstDateWithSlots;
  const slots = activeDate ? (slotsByDate[activeDate] ?? []) : [];
  const activeSlot = slots.find((slot) => slot.start.toISOString() === selectedSlot) ?? null;
  const professional = directory.find((item) => item.professionalId === professionalId) ?? null;

  const confirm = async () => {
    if (!professionalId || !service || !activeSlot || submitting) return;
    setSubmitting(true);
    try {
      const outcome = await bookAppointment(getSupabase(), {
        professionalId,
        serviceId: service.id,
        startsAt: activeSlot.start.toISOString(),
      });
      if (outcome.success) {
        notify(
          `Tu cita quedó para el ${formatGymDate(activeSlot.start)} a las ${formatGymTime(activeSlot.start)}.`,
          'Cita reservada'
        );
        navigation.goBack();
        return;
      }
      notify(outcome.error ?? 'Inténtalo de nuevo.', 'No se pudo reservar');
      // El horario pudo ocuparse mientras elegías: vuelve a consultar los ocupados.
      setSelectedSlot(null);
      try {
        setBusy(await loadBusy(professionalId));
      } catch {
        /* el siguiente intento mostrará el error */
      }
    } finally {
      setSubmitting(false);
    }
  };

  const noServices = !!offer && offer.services.length === 0;
  const noAvailability = !!offer && offer.blocks.length === 0;

  return (
    <View style={styles.container}>
      <Header
        title="Reservar cita"
        subtitle="Sesión 1-a-1"
        leftAction={{ label: 'Volver', onPress: () => navigation.goBack() }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {directoryLoading ? (
          <LoadingView label="Cargando profesionales…" style={styles.center} />
        ) : directoryError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{directoryError}</Text>
            <Button title="Reintentar" variant="ghost" onPress={() => void loadDirectory()} />
          </View>
        ) : directory.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Sin profesionales</Text>
            <Text style={styles.emptyHint}>
              Tu gimnasio todavía no tiene profesionales para citas 1-a-1.
            </Text>
          </View>
        ) : (
          <>
            {directory.length > 1 && (
              <Section title={`${step('professional')}. Profesional`}>
                {directory.map((item) => (
                  <Option
                    key={item.professionalId}
                    title={item.fullName ?? 'Profesional'}
                    subtitle={specialtyLabel(item.specialization)}
                    selected={item.professionalId === professionalId}
                    onPress={() => void selectProfessional(item.professionalId)}
                  />
                ))}
              </Section>
            )}

            {/* Con un solo profesional no hay paso de elección, pero sí queda
                claro con quién es la cita. */}
            {directory.length === 1 && professional && (
              <View style={styles.proBanner}>
                <View style={styles.proAvatar}>
                  <Text style={styles.proAvatarText}>
                    {(professional.fullName ?? 'P').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.proInfo}>
                  <Text style={styles.proEyebrow}>Tu cita será con</Text>
                  <Text style={styles.optionTitle}>{professional.fullName ?? 'Profesional'}</Text>
                  <Text style={styles.optionSubtitle}>
                    {specialtyLabel(professional.specialization)}
                  </Text>
                  {professional.bio ? (
                    <Text style={styles.proBio} numberOfLines={2}>
                      {professional.bio}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {offerLoading && <LoadingView label="Cargando horarios…" style={styles.center} />}

            {offerError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{offerError}</Text>
                <Button
                  title="Reintentar"
                  variant="ghost"
                  onPress={() => professionalId && void selectProfessional(professionalId)}
                />
              </View>
            )}

            {noServices && (
              <Text style={styles.hint}>
                Este profesional aún no ofrece servicios. Prueba con otro o vuelve más tarde.
              </Text>
            )}
            {!noServices && noAvailability && (
              <Text style={styles.hint}>
                Este profesional aún no tiene horarios disponibles. Vuelve más tarde.
              </Text>
            )}

            {offer && !noServices && !noAvailability && (
              <>
                <Section title={`${step('service')}. Servicio`}>
                  {offer.services.map((item) => (
                    <Option
                      key={item.id}
                      title={item.name}
                      subtitle={`${item.duration_minutes} min`}
                      selected={item.id === serviceId}
                      onPress={() => {
                        setServiceId(item.id);
                        setSelectedSlot(null);
                      }}
                    />
                  ))}
                </Section>

                {service && (
                  <Section title={`${step('day')}. Día`}>
                    {firstDateWithSlots === null ? (
                      <Text style={styles.hint}>
                        No hay horarios libres en los próximos {BOOKING_HORIZON_DAYS} días.
                      </Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.dayRow}>
                          {dates.map((date) => {
                            const parts = gymDateParts(date);
                            const enabled = (slotsByDate[date]?.length ?? 0) > 0;
                            const selected = date === activeDate;
                            return (
                              <Pressable
                                key={date}
                                accessibilityRole="button"
                                accessibilityState={{ selected, disabled: !enabled }}
                                accessibilityLabel={`${parts.weekday} ${parts.day} ${parts.month}`}
                                disabled={!enabled}
                                onPress={() => {
                                  setSelectedDate(date);
                                  setSelectedSlot(null);
                                }}
                                style={[
                                  styles.day,
                                  selected && styles.daySelected,
                                  !enabled && styles.dayDisabled,
                                ]}
                              >
                                <Text style={[styles.dayWeekday, selected && styles.dayTextOn]}>
                                  {parts.weekday}
                                </Text>
                                <Text style={[styles.dayNumber, selected && styles.dayTextOn]}>
                                  {parts.day}
                                </Text>
                                <Text style={[styles.dayMonth, selected && styles.dayTextOn]}>
                                  {parts.month}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </ScrollView>
                    )}
                  </Section>
                )}

                {service && activeDate && (
                  <Section title={`${step('time')}. Hora`}>
                    <View style={styles.slotGrid}>
                      {slots.map((slot) => {
                        const iso = slot.start.toISOString();
                        const selected = iso === selectedSlot;
                        return (
                          <Pressable
                            key={iso}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`${formatGymTime(slot.start)} a ${formatGymTime(slot.end)}`}
                            onPress={() => setSelectedSlot(iso)}
                            style={[styles.slot, selected && styles.slotSelected]}
                          >
                            <Text style={[styles.slotText, selected && styles.slotTextOn]}>
                              {formatGymTime(slot.start)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={styles.footnote}>Horario de Costa Rica.</Text>
                  </Section>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {activeSlot && service ? (
          <Text style={styles.summary}>
            {formatGymDate(activeSlot.start)} · {formatGymTime(activeSlot.start)} –{' '}
            {formatGymTime(activeSlot.end)} · {service.name}
            {professional?.fullName ? ` · ${professional.fullName}` : ''}
          </Text>
        ) : (
          <Text style={styles.summary}>
            {missingStepHint({
              needsProfessional: directory.length > 1 && !professionalId,
              hasService: Boolean(service),
              hasSlot: Boolean(activeSlot),
            })}
          </Text>
        )}
        <Button
          title="Confirmar cita"
          fullWidth
          disabled={!activeSlot || submitting}
          loading={submitting}
          onPress={() => void confirm()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 16, gap: 20, paddingBottom: 24 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: colors.azulNexo },
  option: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 56,
    justifyContent: 'center',
  },
  optionSelected: {
    borderColor: colors.turquesa,
    borderWidth: 2,
    backgroundColor: colors.turquesa + '14',
  },
  optionTitle: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: colors.azulNexo },
  optionSubtitle: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  proBanner: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  proAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textAccent,
  },
  proAvatarText: { fontFamily: fonts.uiSemiBold, fontSize: 20, color: colors.white },
  proInfo: { flex: 1, gap: 2 },
  proEyebrow: { fontFamily: fonts.uiRegular, fontSize: 12, color: colors.textSecondary },
  proBio: { fontFamily: fonts.uiRegular, fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  dayRow: { flexDirection: 'row', gap: 8 },
  day: {
    width: 64,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  daySelected: { backgroundColor: colors.turquesa, borderColor: colors.turquesa },
  dayDisabled: { opacity: 0.4 },
  dayWeekday: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  dayNumber: { fontFamily: fonts.uiSemiBold, fontSize: 20, color: colors.azulNexo },
  dayMonth: { fontFamily: fonts.uiRegular, fontSize: 12, color: colors.textSecondary },
  dayTextOn: { color: colors.white },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    minWidth: 84,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.turquesa,
  },
  slotSelected: { backgroundColor: colors.textAccent, borderColor: colors.textAccent },
  slotText: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: colors.textAccent },
  slotTextOn: { color: colors.white },
  footnote: { fontFamily: fonts.uiRegular, fontSize: 12, color: colors.textSecondary },
  hint: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.textSecondary },
  footer: {
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.crema,
  },
  summary: { fontFamily: fonts.uiRegular, fontSize: 13, color: colors.azulNexo },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
  emptyHint: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorBox: {
    padding: 12,
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    gap: 8,
  },
  errorText: { fontFamily: fonts.uiRegular, fontSize: 13, color: colors.textError },
});
