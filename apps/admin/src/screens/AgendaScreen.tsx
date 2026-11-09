import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, formatWeekdayDate } from '@nexofit/core';
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  ErrorText,
  FilterChips,
  LoadingView,
} from '../components/ui';
import { useAgenda, type AgendaAppointment, type AgendaClass } from '../hooks/useAdminData';
import type { ScreenProps } from '../app/router';
import { dayLabel, startOfLocalDay, toLocalDateStr } from '../utils/date';
import { formatTime } from '../utils/format';

const BOOKING_LABELS: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Reservó', color: colors.turquesa },
  attended: { label: 'Asistió', color: colors.success },
  no_show: { label: 'No vino', color: colors.warning },
  cancelled: { label: 'Canceló', color: colors.danger },
};

const APPOINTMENT_LABELS: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Confirmada', color: colors.turquesa },
  attended: { label: 'Atendida', color: colors.success },
  no_show: { label: 'No asistió', color: colors.warning },
  cancelled: { label: 'Cancelada', color: colors.danger },
};

type Tab = 'clases' | 'citas';

/**
 * Agenda del gimnasio en la consola (antes solo existía en la app móvil):
 * clases del día con quién reservó y citas 1-a-1 con cancelación.
 * Día y pestaña viven en la URL (?dia=AAAA-MM-DD&ver=citas).
 */
export function AgendaScreen({ organizationId, navigate, params }: ScreenProps) {
  const today = toLocalDateStr();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.dia ?? '') ? params.dia : today;
  const tab: Tab = params.ver === 'citas' ? 'citas' : 'clases';
  const agenda = useAgenda(organizationId, date);
  const [toCancel, setToCancel] = useState<AgendaAppointment | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const go = (next: { dia?: string; ver?: Tab }) =>
    navigate(
      'agenda',
      {
        dia: (next.dia ?? date) === today ? '' : (next.dia ?? date),
        ver: (next.ver ?? tab) === 'clases' ? '' : (next.ver ?? tab),
      },
      true
    );

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = startOfLocalDay(today);
    d.setDate(d.getDate() + i);
    return toLocalDateStr(d);
  });

  const confirmCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    setCancelError(null);
    const result = await agenda.cancelAppointment(toCancel.id);
    setCancelling(false);
    setToCancel(null);
    if (!result.success) setCancelError(result.error ?? 'No se pudo cancelar la cita.');
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.h1}>Agenda</Text>
        <Button label="↻ Actualizar" variant="ghost" onPress={() => void agenda.refresh()} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
        <View style={styles.days}>
          {days.map((day) => {
            const active = day === date;
            const iso = startOfLocalDay(day).toISOString();
            return (
              <TouchableOpacity
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.day, active && styles.dayActive]}
                onPress={() => go({ dia: day })}
              >
                <Text style={[styles.dayLabel, active && styles.dayTextActive]}>
                  {dayLabel(iso) ?? formatWeekdayDate(iso)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <FilterChips<Tab>
        label="Vista"
        value={tab}
        onChange={(value) => go({ ver: value })}
        options={[
          { value: 'clases', label: `Clases (${agenda.classes.length})` },
          { value: 'citas', label: `Citas 1-a-1 (${agenda.appointments.length})` },
        ]}
      />

      {agenda.error && <ErrorText>{agenda.error}</ErrorText>}
      {cancelError && <ErrorText>{cancelError}</ErrorText>}

      {agenda.loading ? (
        <LoadingView label="Cargando agenda…" />
      ) : tab === 'clases' ? (
        agenda.classes.length === 0 ? (
          <Card>
            <EmptyState
              title="Sin clases este día"
              subtitle="Las clases se programan desde la app móvil con «Nueva clase»."
            />
          </Card>
        ) : (
          <View style={styles.list}>
            {agenda.classes.map((cls) => (
              <ClassCard key={cls.id} cls={cls} />
            ))}
          </View>
        )
      ) : agenda.appointments.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin citas este día"
            subtitle="Las citas que reserven los miembros con los profesionales aparecerán aquí."
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {agenda.appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onCancel={() => setToCancel(appointment)}
            />
          ))}
        </View>
      )}

      <ConfirmModal
        visible={toCancel !== null}
        title="Cancelar cita"
        message={
          toCancel
            ? `${toCancel.client} recibirá un aviso de que su cita «${toCancel.service}» de las ${formatTime(toCancel.startsAt)} fue cancelada.`
            : ''
        }
        confirmLabel="Cancelar cita"
        destructive
        busy={cancelling}
        onConfirm={() => void confirmCancel()}
        onCancel={() => setToCancel(null)}
      />
    </View>
  );
}

function ClassCard({ cls }: { cls: AgendaClass }) {
  const [open, setOpen] = useState(false);
  const active = cls.attendees.filter((a) => a.status !== 'cancelled');
  const pct = cls.capacity > 0 ? Math.round((active.length / cls.capacity) * 100) : 0;

  return (
    <Card style={styles.card}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${cls.name} a las ${formatTime(cls.startsAt)}: ver quién reservó`}
        onPress={() => setOpen((value) => !value)}
        activeOpacity={0.8}
        style={styles.cardHeader}
      >
        <View style={[styles.colorBar, { backgroundColor: cls.color }]} />
        <View style={styles.cardBody}>
          <Text style={styles.time}>
            {formatTime(cls.startsAt)} – {formatTime(cls.endsAt)}
          </Text>
          <Text style={styles.title}>{cls.name}</Text>
          <Text style={styles.meta}>
            Coach: {cls.coach}
            {cls.location ? ` · ${cls.location}` : ''}
          </Text>
        </View>
        <View style={styles.occupancy}>
          <Text style={styles.occupancyValue}>
            {active.length}/{cls.capacity}
          </Text>
          <Text style={styles.meta}>
            {pct}% · {open ? 'Ocultar' : 'Ver lista'}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.bar}>
        <View
          style={[styles.barFill, { width: `${Math.min(pct, 100)}%` }, pct >= 90 && styles.barFull]}
        />
      </View>
      {open &&
        (cls.attendees.length === 0 ? (
          <Text style={styles.meta}>Nadie ha reservado todavía.</Text>
        ) : (
          <View style={styles.attendees}>
            {cls.attendees.map((a) => {
              const badge = BOOKING_LABELS[a.status] ?? {
                label: a.status,
                color: colors.textMuted,
              };
              return (
                <View key={a.bookingId} style={styles.attendee}>
                  <Text style={styles.attendeeName}>{a.name}</Text>
                  <Badge label={badge.label} color={badge.color} />
                </View>
              );
            })}
            <Text style={styles.meta}>La asistencia se marca desde la app móvil (Agenda).</Text>
          </View>
        ))}
    </Card>
  );
}

function AppointmentCard({
  appointment,
  onCancel,
}: {
  appointment: AgendaAppointment;
  onCancel: () => void;
}) {
  const badge = APPOINTMENT_LABELS[appointment.status] ?? {
    label: appointment.status,
    color: colors.textMuted,
  };
  const cancellable =
    appointment.status === 'confirmed' && new Date(appointment.startsAt).getTime() > Date.now();
  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardBody}>
          <Text style={styles.time}>
            {formatTime(appointment.startsAt)} – {formatTime(appointment.endsAt)}
          </Text>
          <Text style={styles.title}>{appointment.service}</Text>
          <Text style={styles.meta}>
            Cliente: {appointment.client}
            {appointment.phone ? ` · Tel. ${appointment.phone}` : ''}
          </Text>
          <Text style={styles.meta}>Profesional: {appointment.professional}</Text>
        </View>
        <View style={styles.appointmentSide}>
          <Badge label={badge.label} color={badge.color} />
          {cancellable && <Button label="Cancelar" variant="ghost" onPress={onCancel} />}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  h1: { fontFamily: fonts.brand, fontSize: 26, color: colors.azulNexo },
  daysScroll: { flexGrow: 0 },
  days: { flexDirection: 'row', gap: 8 },
  day: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dayActive: { backgroundColor: colors.azulNexo, borderColor: colors.azulNexo },
  dayLabel: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.azulNexo },
  dayTextActive: { color: colors.white },
  list: { gap: 12 },
  card: { gap: 12, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  colorBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  cardBody: { flex: 1, minWidth: 200, gap: 2 },
  time: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: colors.textAccent },
  title: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.azulNexo },
  meta: { fontFamily: fonts.uiRegular, fontSize: 13, color: colors.textSecondary },
  occupancy: { alignItems: 'flex-end', gap: 2 },
  occupancyValue: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceSubtle, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.turquesa, borderRadius: 3 },
  barFull: { backgroundColor: colors.danger },
  attendees: { gap: 8 },
  attendee: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
  },
  attendeeName: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.azulNexo },
  appointmentSide: { alignItems: 'flex-end', gap: 8 },
});
