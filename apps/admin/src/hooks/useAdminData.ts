import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase, type RoleType } from '@nexofit/core';
import type { Session } from '@supabase/supabase-js';
import { toLocalDateStr, startOfLocalDay, endOfLocalDay } from '../utils/date';
import { holdLoading } from '../utils/loading';
import { friendlyError } from '../utils/errors';

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
}

export interface ActivityItem {
  id: string;
  kind: 'booked' | 'cancelled' | 'joined';
  text: string;
  iso: string;
}

export interface UpcomingClass {
  id: string;
  name: string;
  color: string;
  time: string;
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
  refresh: () => Promise<void>;
}

export function useDashboard(organizationId: string): DashboardData {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          time: new Date(s.starts_at).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          }),
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
      });
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

  return { stats, activity, upcoming, loading, error, refresh: fetchData };
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

export interface PaymentsData {
  payments: PaymentItem[];
  monthCount: number;
  monthRevenueCents: number;
  monthCurrency: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePayments(organizationId: string): PaymentsData {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
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

      const [paymentsRes, monthRes] = await Promise.all([
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
      ]);

      if (paymentsRes.error || monthRes.error) {
        setError(
          friendlyError(paymentsRes.error ?? monthRes.error, 'No se pudieron cargar los pagos.')
        );
        return;
      }

      setPayments(
        ((paymentsRes.data ?? []) as unknown as PaymentRowShape[]).map((row) => ({
          id: row.id,
          memberName: row.profiles?.full_name ?? null,
          planName: row.membership_plans?.name ?? null,
          amountCents: row.amount_cents,
          currency: row.currency,
          method: row.method,
          status: row.status,
          paidAt: row.paid_at,
        }))
      );

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

  return {
    payments,
    monthCount,
    monthRevenueCents,
    monthCurrency,
    loading,
    error,
    refresh: fetchData,
  };
}
