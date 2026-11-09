import { useCallback, useEffect, useRef, useState } from 'react';
import { colors, getSupabase, type RoleType } from '@nexofit/core';
import type { Session } from '@supabase/supabase-js';
import { toLocalDateStr, startOfLocalDay, endOfLocalDay, previousMonthToDate } from '../utils/date';
import { holdLoading } from '../utils/loading';
import { friendlyError } from '../utils/errors';
import { formatMoney } from '../utils/format';

// ============================================================
// Consola web de administración — datos reales de Supabase.
// Mismas consultas que la app móvil (RLS multi-tenant incluida):
// todo queda scoped a la organización de la membresía admin.
// ============================================================

// ------------------------------------------------------------
// Sesión: acceso exclusivo para administradores de organización
// ------------------------------------------------------------

export interface AdminMembership {
  membershipId: string;
  organizationId: string;
  organizationName: string;
}

export interface AdminSessionState {
  session: Session | null;
  membership: AdminMembership | null;
  loading: boolean;
  accessError: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export function useAdminSession(): AdminSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<AdminMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadMembership = useCallback(async (next: Session | null) => {
    const request = ++requestId.current;
    setSession(next);

    if (!next) {
      setMembership(null);
      setAccessError(null);
      setLoading(false);
      return;
    }

    try {
      const { data } = await getSupabase()
        .from('memberships')
        .select('id, organization_id, organizations ( name )')
        .eq('profile_id', next.user.id)
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();

      if (request !== requestId.current) return;

      if (data) {
        setMembership({
          membershipId: data.id,
          organizationId: data.organization_id,
          organizationName:
            (data.organizations as unknown as { name: string } | null)?.name ?? 'Gimnasio',
        });
        setAccessError(null);
      } else {
        setMembership(null);
        setAccessError('Esta cuenta no tiene una membresía de administrador en ningún gimnasio.');
      }
    } catch {
      if (request === requestId.current) {
        setMembership(null);
        setAccessError('No pudimos validar tu acceso. Revisa tu conexión e inténtalo de nuevo.');
      }
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    // onAuthStateChange emite la sesión inicial al suscribirse.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      void loadMembership(next);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadMembership]);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) return friendlyError(error, 'Correo o contraseña incorrectos.');
    return null;
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  return { session, membership, loading, accessError, signIn, signOut };
}

// ------------------------------------------------------------
// Dashboard: métricas, actividad reciente y próximas clases
// ------------------------------------------------------------

export interface DashboardStats {
  activeMembers: number;
  newMembersThisMonth: number;
  sessionsToday: number;
  occupancy7d: number | null;
  bookingsThisMonth: number;
  monthRevenueCents: number;
  monthCurrency: string | null;
  /** Mismo periodo del mes anterior (día 1 → hoy), para comparar. */
  prevNewMembers: number;
  prevBookings: number;
  prevRevenueCents: number;
}

export interface ActivityItem {
  id: string;
  kind: 'booked' | 'cancelled' | 'joined' | 'payment' | 'appointment';
  text: string;
  iso: string;
}

export interface UpcomingClass {
  id: string;
  name: string;
  color: string;
  startsAt: string;
  coach: string;
  spots: string;
}

const SESSION_SELECT = `
  id,
  starts_at,
  capacity_override,
  class_types!inner ( name, color ),
  spaces ( capacity ),
  coaches ( memberships ( profiles ( full_name ) ) )
`;

interface SessionRowShape {
  id: string;
  starts_at: string;
  capacity_override: number | null;
  class_types: { name: string; color: string } | null;
  spaces: { capacity: number } | null;
  coaches: { memberships: { profiles: { full_name: string | null } | null } | null } | null;
}

interface RecentBookingRow {
  id: string;
  created_at: string;
  cancelled_at: string | null;
  profiles: { full_name: string | null } | null;
  sessions: { class_types: { name: string } | null } | null;
}

interface NewMemberRow {
  id: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

export interface DashboardData {
  stats: DashboardStats | null;
  activity: ActivityItem[];
  upcoming: UpcomingClass[];
  loading: boolean;
  error: string | null;
  updatedAt: string | null;
  refresh: () => Promise<void>;
}

export function useDashboard(organizationId: string): DashboardData {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const startedAt = Date.now();
    setLoading(true);
    setError(null);

    try {
      if (!organizationId) {
        setStats(null);
        setActivity([]);
        setUpcoming([]);
        return;
      }

      const supabase = getSupabase();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { start: prevStart, end: prevEnd } = previousMonthToDate(now);
      const nowISO = now.toISOString();
      const weekEnd = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
      const today = toLocalDateStr();
      const dayStart = startOfLocalDay(today).toISOString();
      const dayEnd = endOfLocalDay(today).toISOString();

      const [
        membersTotalRes,
        membersMonthRes,
        todaySessionsRes,
        bookingsMonthRes,
        monthRevenueRes,
        weekSessionsRes,
        recentConfirmedRes,
        recentCancelledRes,
        newMembersRes,
        prevMembersRes,
        prevBookingsRes,
        prevRevenueRes,
        recentPaymentsRes,
        recentAppointmentsRes,
      ] = await Promise.all([
        supabase
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        supabase
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('created_at', monthStart),
        // Clases de hoy (ámbito vía class_types!inner, mismo patrón que móvil).
        supabase
          .from('sessions')
          .select('id, class_types!inner ( organization_id )')
          .eq('class_types.organization_id', organizationId)
          .gte('starts_at', dayStart)
          .lt('starts_at', dayEnd),
        // Reservas creadas este mes (RLS: admin/coach ven las del org).
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', monthStart),
        // Ingresos del mes (pagos registrados y cobrados; RLS: admin).
        supabase
          .from('payments')
          .select('amount_cents, currency')
          .eq('organization_id', organizationId)
          .eq('status', 'paid')
          .gte('paid_at', monthStart),
        // Sesiones de los próximos 7 días: ocupación + próximas clases.
        supabase
          .from('sessions')
          .select(SESSION_SELECT)
          .eq('class_types.organization_id', organizationId)
          .gte('starts_at', nowISO)
          .lt('starts_at', weekEnd)
          .order('starts_at', { ascending: true }),
        supabase
          .from('bookings')
          .select('id, created_at, profiles ( full_name ), sessions ( class_types ( name ) )')
          .eq('status', 'confirmed')
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('bookings')
          .select('id, cancelled_at, profiles ( full_name ), sessions ( class_types ( name ) )')
          .eq('status', 'cancelled')
          .not('cancelled_at', 'is', null)
          .order('cancelled_at', { ascending: false })
          .limit(2),
        supabase
          .from('memberships')
          .select('id, created_at, profiles ( full_name )')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(2),
        // Comparativa: mismo tramo del mes anterior (día 1 → día de hoy).
        supabase
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('created_at', prevStart)
          .lt('created_at', prevEnd),
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', prevStart)
          .lt('created_at', prevEnd),
        supabase
          .from('payments')
          .select('amount_cents')
          .eq('organization_id', organizationId)
          .eq('status', 'paid')
          .gte('paid_at', prevStart)
          .lt('paid_at', prevEnd),
        // Actividad: últimos pagos y citas 1-a-1 (antes solo clases y altas).
        supabase
          .from('payments')
          .select(
            'id, amount_cents, currency, paid_at, profiles!payments_profile_id_fkey ( full_name )'
          )
          .eq('organization_id', organizationId)
          .order('paid_at', { ascending: false })
          .limit(3),
        supabase
          .from('appointments')
          .select(
            'id, status, created_at, cancelled_at, services ( name ), patient:profiles!appointments_profile_id_fkey ( full_name )'
          )
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      const firstError = [
        membersTotalRes.error?.message,
        membersMonthRes.error?.message,
        todaySessionsRes.error?.message,
        bookingsMonthRes.error?.message,
        monthRevenueRes.error?.message,
        weekSessionsRes.error?.message,
        recentConfirmedRes.error?.message,
        recentCancelledRes.error?.message,
        newMembersRes.error?.message,
      ].find(Boolean);
      if (firstError) setError(friendlyError(firstError, 'No se pudo cargar el resumen.'));

      const weekRows = (weekSessionsRes.data ?? []) as unknown as SessionRowShape[];

      // Reservas confirmadas por sesión (una sola consulta; RLS las deja ver).
      const counts: Record<string, number> = {};
      if (weekRows.length > 0) {
        const { data: bookingRows } = await supabase
          .from('bookings')
          .select('session_id')
          .eq('status', 'confirmed')
          .in(
            'session_id',
            weekRows.map((s) => s.id)
          );
        for (const row of bookingRows ?? []) {
          counts[row.session_id] = (counts[row.session_id] ?? 0) + 1;
        }
      }

      const sessionCapacity = (s: SessionRowShape) =>
        s.capacity_override ?? s.spaces?.capacity ?? 0;

      // Ocupación media = reservas / capacidad de los próximos 7 días.
      let capacitySum = 0;
      let bookedSum = 0;
      for (const s of weekRows) {
        const cap = sessionCapacity(s);
        if (cap > 0) {
          capacitySum += cap;
          bookedSum += Math.min(counts[s.id] ?? 0, cap);
        }
      }

      // Actividad reciente: reservas + cancelaciones + altas de miembros.
      type Timed = ActivityItem & { sortDate: Date };
      const feed: Timed[] = [];

      for (const b of (recentConfirmedRes.data ?? []) as unknown as RecentBookingRow[]) {
        feed.push({
          id: `booking-${b.id}`,
          kind: 'booked',
          text: `${b.profiles?.full_name ?? 'Alguien'} reservó «${b.sessions?.class_types?.name ?? 'una clase'}»`,
          iso: b.created_at,
          sortDate: new Date(b.created_at),
        });
      }
      for (const b of (recentCancelledRes.data ?? []) as unknown as RecentBookingRow[]) {
        if (!b.cancelled_at) continue;
        feed.push({
          id: `cancel-${b.id}`,
          kind: 'cancelled',
          text: `${b.profiles?.full_name ?? 'Alguien'} canceló «${b.sessions?.class_types?.name ?? 'una clase'}»`,
          iso: b.cancelled_at,
          sortDate: new Date(b.cancelled_at),
        });
      }
      for (const m of (newMembersRes.data ?? []) as unknown as NewMemberRow[]) {
        feed.push({
          id: `member-${m.id}`,
          kind: 'joined',
          text: `Nuevo miembro: ${m.profiles?.full_name ?? 'sin nombre'}`,
          iso: m.created_at,
          sortDate: new Date(m.created_at),
        });
      }

      for (const p of (recentPaymentsRes.data ?? []) as unknown as RecentPaymentRow[]) {
        feed.push({
          id: `payment-${p.id}`,
          kind: 'payment',
          text: `${p.profiles?.full_name ?? 'Alguien'} pagó ${formatMoney(p.amount_cents, p.currency)}`,
          iso: p.paid_at,
          sortDate: new Date(p.paid_at),
        });
      }
      for (const a of (recentAppointmentsRes.data ?? []) as unknown as RecentAppointmentRow[]) {
        const cancelled = a.status === 'cancelled' && a.cancelled_at;
        const iso = cancelled ? (a.cancelled_at as string) : a.created_at;
        feed.push({
          id: `appointment-${a.id}`,
          kind: cancelled ? 'cancelled' : 'appointment',
          text: `${a.patient?.full_name ?? 'Alguien'} ${cancelled ? 'canceló' : 'reservó'} la cita «${a.services?.name ?? 'cita'}»`,
          iso,
          sortDate: new Date(iso),
        });
      }

      setActivity(
        feed
          .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
          .slice(0, 8)
          .map(({ sortDate: _sortDate, ...item }) => item)
      );

      // Próximas 4 clases con sus cupos.
      setUpcoming(
        weekRows.slice(0, 4).map((s) => ({
          id: s.id,
          name: s.class_types?.name ?? 'Clase',
          color: s.class_types?.color ?? '#0B9B91',
          startsAt: s.starts_at,
          coach: s.coaches?.memberships?.profiles?.full_name ?? 'Sin coach',
          spots: `${counts[s.id] ?? 0}/${sessionCapacity(s)}`,
        }))
      );

      const monthRows = (monthRevenueRes.data ?? []) as {
        amount_cents: number;
        currency: string;
      }[];

      setStats({
        activeMembers: membersTotalRes.count ?? 0,
        newMembersThisMonth: membersMonthRes.count ?? 0,
        sessionsToday: todaySessionsRes.data?.length ?? 0,
        occupancy7d: capacitySum > 0 ? Math.round((bookedSum / capacitySum) * 100) : null,
        bookingsThisMonth: bookingsMonthRes.count ?? 0,
        monthRevenueCents: monthRows.reduce((sum, r) => sum + r.amount_cents, 0),
        monthCurrency: monthRows[0]?.currency ?? null,
        prevNewMembers: prevMembersRes.count ?? 0,
        prevBookings: prevBookingsRes.count ?? 0,
        prevRevenueCents: ((prevRevenueRes.data ?? []) as { amount_cents: number }[]).reduce(
          (sum, r) => sum + r.amount_cents,
          0
        ),
      });
      setUpdatedAt(new Date().toISOString());
    } catch {
      setError('No pudimos cargar el dashboard. Revisa tu conexión.');
    } finally {
      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { stats, activity, upcoming, loading, error, updatedAt, refresh: fetchData };
}

interface RecentPaymentRow {
  id: string;
  amount_cents: number;
  currency: string;
  paid_at: string;
  profiles: { full_name: string | null } | null;
}

interface RecentAppointmentRow {
  id: string;
  status: string;
  created_at: string;
  cancelled_at: string | null;
  services: { name: string } | null;
  patient: { full_name: string | null } | null;
}

// ------------------------------------------------------------
// Agenda del día: clases (con quién reservó) y citas 1-a-1
// ------------------------------------------------------------

export interface AgendaClass {
  id: string;
  name: string;
  color: string;
  startsAt: string;
  endsAt: string;
  coach: string;
  location: string;
  capacity: number;
  attendees: { bookingId: string; name: string; status: string }[];
}

export interface AgendaAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  service: string;
  client: string;
  phone: string | null;
  professional: string;
}

interface AgendaSessionRow {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity_override: number | null;
  class_types: { name: string; color: string } | null;
  spaces: { name: string; capacity: number; venues: { name: string } | null } | null;
  coaches: { memberships: { profiles: { full_name: string | null } | null } | null } | null;
  bookings: { id: string; status: string; profiles: { full_name: string | null } | null }[];
}

interface AgendaAppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  professional_id: string;
  services: { name: string } | null;
  patient: { full_name: string | null; phone: string | null } | null;
}

export function useAgenda(organizationId: string, date: string) {
  const [classes, setClasses] = useState<AgendaClass[]>([]);
  const [appointments, setAppointments] = useState<AgendaAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    const supabase = getSupabase();
    const from = startOfLocalDay(date).toISOString();
    const to = endOfLocalDay(date).toISOString();
    try {
      const [sessionsRes, appointmentsRes, directoryRes] = await Promise.all([
        supabase
          .from('sessions')
          .select(
            `id, starts_at, ends_at, capacity_override,
             class_types!inner ( name, color, organization_id ),
             spaces ( name, capacity, venues ( name ) ),
             coaches ( memberships ( profiles ( full_name ) ) ),
             bookings ( id, status, profiles ( full_name ) )`
          )
          .eq('class_types.organization_id', organizationId)
          .gte('starts_at', from)
          .lt('starts_at', to)
          .order('starts_at'),
        supabase
          .from('appointments')
          .select(
            `id, starts_at, ends_at, status, professional_id, services ( name ),
             patient:profiles!appointments_profile_id_fkey ( full_name, phone )`
          )
          .eq('organization_id', organizationId)
          .gte('starts_at', from)
          .lt('starts_at', to)
          .order('starts_at'),
        // Nombres de profesionales (RPC: el perfil de otros no siempre es legible).
        supabase.rpc('list_org_professionals'),
      ]);
      if (sessionsRes.error || appointmentsRes.error) {
        setError(
          friendlyError(sessionsRes.error ?? appointmentsRes.error, 'No se pudo cargar la agenda.')
        );
        return;
      }
      const names = new Map(
        (directoryRes.data ?? []).map((row) => [
          row.professional_id,
          row.full_name ?? 'Profesional',
        ])
      );
      setClasses(
        ((sessionsRes.data ?? []) as unknown as AgendaSessionRow[]).map((s) => ({
          id: s.id,
          name: s.class_types?.name ?? 'Clase',
          color: s.class_types?.color ?? colors.turquesa,
          startsAt: s.starts_at,
          endsAt: s.ends_at,
          coach: s.coaches?.memberships?.profiles?.full_name ?? 'Sin coach',
          location: [s.spaces?.venues?.name, s.spaces?.name].filter(Boolean).join(' · '),
          capacity: s.capacity_override ?? s.spaces?.capacity ?? 0,
          attendees: (s.bookings ?? []).map((b) => ({
            bookingId: b.id,
            name: b.profiles?.full_name ?? 'Sin nombre',
            status: b.status,
          })),
        }))
      );
      setAppointments(
        ((appointmentsRes.data ?? []) as unknown as AgendaAppointmentRow[]).map((a) => ({
          id: a.id,
          startsAt: a.starts_at,
          endsAt: a.ends_at,
          status: a.status,
          service: a.services?.name ?? 'Cita',
          client: a.patient?.full_name ?? 'Sin nombre',
          phone: a.patient?.phone ?? null,
          professional: names.get(a.professional_id) ?? 'Profesional',
        }))
      );
    } catch {
      setError('No pudimos cargar la agenda. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [organizationId, date]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  /** Cancela una cita confirmada; el trigger de la base avisa al miembro. */
  const cancelAppointment = useCallback(
    async (appointmentId: string) => {
      const { data, error: updateErr } = await getSupabase()
        .from('appointments')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', appointmentId)
        .eq('organization_id', organizationId)
        .eq('status', 'confirmed')
        .select('id');
      if (updateErr || !data || data.length === 0) {
        return {
          success: false,
          error: 'La cita cambió o ya no se puede cancelar. Recarga la agenda.',
        };
      }
      await fetchData();
      return { success: true };
    },
    [organizationId, fetchData]
  );

  return { classes, appointments, loading, error, refresh: fetchData, cancelAppointment };
}

// ------------------------------------------------------------
// Miembros del gimnasio (con cambio de rol)
// ------------------------------------------------------------

export interface OrgMember {
  membershipId: string;
  profileId: string;
  role: RoleType;
  fullName: string;
  phone: string | null;
  createdAt: string;
}

interface MembershipRowShape {
  id: string;
  profile_id: string;
  role: RoleType;
  created_at: string;
  profiles: { full_name: string | null; phone: string | null } | null;
}

export interface OrgMembersData {
  members: OrgMember[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateRole: (
    membershipId: string,
    role: RoleType
  ) => Promise<{ success: boolean; error?: string }>;
}

export function useOrgMembers(organizationId: string): OrgMembersData {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    const startedAt = Date.now();
    setLoading(true);
    setError(null);

    try {
      if (!organizationId) {
        setMembers([]);
        return;
      }

      const supabase = getSupabase();
      const { data, error: fetchErr } = await supabase
        .from('memberships')
        .select(
          `id, profile_id, role, created_at,
           profiles ( full_name, phone )`
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (fetchErr) {
        setError(friendlyError(fetchErr, 'No se pudieron cargar los miembros.'));
        setMembers([]);
        return;
      }

      setMembers(
        ((data ?? []) as unknown as MembershipRowShape[]).map((row) => ({
          membershipId: row.id,
          profileId: row.profile_id,
          role: row.role,
          fullName: row.profiles?.full_name ?? 'Sin nombre',
          phone: row.profiles?.phone ?? null,
          createdAt: row.created_at,
        }))
      );
    } finally {
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Actualiza en el servidor y, si salió bien, en el estado local (sin flash).
  const updateRole = useCallback(async (membershipId: string, role: RoleType) => {
    const supabase = getSupabase();
    // .select('id') tras el update: PostgREST con RLS silencia los
    // updates denegados (0 filas), y así lo detectamos.
    const { data, error: updateErr } = await supabase
      .from('memberships')
      .update({ role })
      .eq('id', membershipId)
      .select('id');

    if (updateErr) {
      // Detalle crudo solo en consola; la pantalla muestra su propio copy.
      console.warn('update member role failed', updateErr.message);
      return { success: false };
    }
    if (!data || data.length === 0) {
      return { success: false, error: 'No tienes permiso para cambiar roles.' };
    }
    setMembers((prev) => prev.map((m) => (m.membershipId === membershipId ? { ...m, role } : m)));
    return { success: true };
  }, []);

  return { members, loading, error, refresh: fetchMembers, updateRole };
}

// ------------------------------------------------------------
// Detalle de un miembro (panel lateral de Miembros)
// ------------------------------------------------------------

export interface MemberDetail {
  payments: PaymentItem[];
  bookings30d: number;
  attended30d: number;
  lastBookingAt: string | null;
}

export function useMemberDetail(organizationId: string, profileId: string | null) {
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId || !organizationId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      const supabase = getSupabase();
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [paymentsRes, bookingsRes] = await Promise.all([
        supabase
          .from('payments')
          .select(
            `id, amount_cents, currency, method, status, paid_at,
             profiles!payments_profile_id_fkey ( full_name ),
             membership_plans ( name )`
          )
          .eq('organization_id', organizationId)
          .eq('profile_id', profileId)
          .order('paid_at', { ascending: false })
          .limit(5),
        // Reservas de los últimos 30 días en clases de este gimnasio.
        supabase
          .from('bookings')
          .select(
            'id, status, created_at, sessions!inner ( class_types!inner ( organization_id ) )'
          )
          .eq('profile_id', profileId)
          .eq('sessions.class_types.organization_id', organizationId)
          .gte('created_at', since)
          .order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (paymentsRes.error || bookingsRes.error) {
        setError(
          friendlyError(paymentsRes.error ?? bookingsRes.error, 'No se pudo cargar el detalle.')
        );
        setLoading(false);
        return;
      }
      const bookings = (bookingsRes.data ?? []) as { status: string; created_at: string }[];
      setDetail({
        payments: ((paymentsRes.data ?? []) as unknown as PaymentRowShape[]).map(mapPaymentRow),
        bookings30d: bookings.filter((b) => b.status !== 'cancelled').length,
        attended30d: bookings.filter((b) => b.status === 'attended').length,
        lastBookingAt: bookings[0]?.created_at ?? null,
      });
      setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [organizationId, profileId]);

  return { detail, loading, error };
}

// ------------------------------------------------------------
// Pagos: historial e ingresos del mes
// ------------------------------------------------------------

export interface PaymentItem {
  id: string;
  memberName: string | null;
  planName: string | null;
  amountCents: number;
  currency: string;
  method: string;
  status: string;
  paidAt: string;
}

interface PaymentRowShape {
  id: string;
  amount_cents: number;
  currency: string;
  method: string;
  status: string;
  paid_at: string;
  profiles: { full_name: string | null } | null;
  membership_plans: { name: string } | null;
}

function mapPaymentRow(row: PaymentRowShape): PaymentItem {
  return {
    id: row.id,
    memberName: row.profiles?.full_name ?? null,
    planName: row.membership_plans?.name ?? null,
    amountCents: row.amount_cents,
    currency: row.currency,
    method: row.method,
    status: row.status,
    paidAt: row.paid_at,
  };
}

export interface PlanOption {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  durationDays: number;
}

export interface RegisterPaymentInput {
  profileId: string;
  planId: string | null;
  amountCents: number;
  currency: string;
  method: string;
  notes: string;
  createdBy: string;
}

export interface PaymentsData {
  payments: PaymentItem[];
  plans: PlanOption[];
  monthCount: number;
  monthRevenueCents: number;
  monthCurrency: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  registerPayment: (input: RegisterPaymentInput) => Promise<{ success: boolean; error?: string }>;
}

export function usePayments(organizationId: string): PaymentsData {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [monthCount, setMonthCount] = useState(0);
  const [monthRevenueCents, setMonthRevenueCents] = useState(0);
  const [monthCurrency, setMonthCurrency] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const startedAt = Date.now();
    setLoading(true);
    setError(null);

    try {
      if (!organizationId) {
        setPayments([]);
        setMonthCount(0);
        setMonthRevenueCents(0);
        setMonthCurrency(null);
        return;
      }

      const supabase = getSupabase();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [paymentsRes, monthRes, plansRes] = await Promise.all([
        supabase
          .from('payments')
          .select(
            `id, amount_cents, currency, method, status, paid_at,
             profiles!payments_profile_id_fkey ( full_name ),
             membership_plans ( name )`
          )
          .eq('organization_id', organizationId)
          .order('paid_at', { ascending: false })
          .limit(50),
        // Ingresos del mes: consulta aparte para no depender del límite de 50.
        supabase
          .from('payments')
          .select('amount_cents, currency')
          .eq('organization_id', organizationId)
          .eq('status', 'paid')
          .gte('paid_at', monthStart),
        // Planes activos para el formulario «Registrar pago».
        supabase
          .from('membership_plans')
          .select('id, name, price_cents, currency, duration_days')
          .eq('organization_id', organizationId)
          .eq('active', true)
          .order('name'),
      ]);

      if (!plansRes.error) {
        setPlans(
          (plansRes.data ?? []).map((plan) => ({
            id: plan.id,
            name: plan.name,
            priceCents: plan.price_cents,
            currency: plan.currency,
            durationDays: plan.duration_days,
          }))
        );
      }

      if (paymentsRes.error || monthRes.error) {
        setError(
          friendlyError(paymentsRes.error ?? monthRes.error, 'No se pudieron cargar los pagos.')
        );
        return;
      }

      setPayments(((paymentsRes.data ?? []) as unknown as PaymentRowShape[]).map(mapPaymentRow));

      const monthRows = (monthRes.data ?? []) as { amount_cents: number; currency: string }[];
      setMonthRevenueCents(monthRows.reduce((sum, r) => sum + r.amount_cents, 0));
      setMonthCount(monthRows.length);
      setMonthCurrency(monthRows[0]?.currency ?? null);
    } catch {
      setError('No pudimos cargar los pagos. Revisa tu conexión.');
    } finally {
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Mismo insert que la app móvil (RLS: solo admin). El pago queda «pagado».
  const registerPayment = useCallback(
    async (input: RegisterPaymentInput) => {
      const { error: insertErr } = await getSupabase()
        .from('payments')
        .insert({
          organization_id: organizationId,
          profile_id: input.profileId,
          plan_id: input.planId,
          amount_cents: input.amountCents,
          currency: input.currency,
          method: input.method,
          notes: input.notes.trim() ? input.notes.trim() : null,
          created_by: input.createdBy,
          status: 'paid',
        });
      if (insertErr) {
        console.warn('register payment failed', insertErr.message);
        return { success: false, error: friendlyError(insertErr, 'No se pudo registrar el pago.') };
      }
      await fetchData();
      return { success: true };
    },
    [organizationId, fetchData]
  );

  return {
    payments,
    plans,
    monthCount,
    monthRevenueCents,
    monthCurrency,
    loading,
    error,
    refresh: fetchData,
    registerPayment,
  };
}
