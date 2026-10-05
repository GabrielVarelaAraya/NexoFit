import { useState, useCallback, useEffect } from 'react';
import { getSupabase, type RoleType } from '@nexofit/core';
import { toLocalDateStr, startOfLocalDay, endOfLocalDay } from '../utils/date';
import { holdLoading } from '../utils/loading';

// ============================================================
// Stage 6 · Datos reales para las pantallas de administración
// (Dashboard, Agenda y Clientes). Ningún mock.
// ============================================================

// ------------------------------------------------------------
// Clientes: miembros del org (memberships + profiles)
// ------------------------------------------------------------

export interface OrgMember {
  membershipId: string;
  profileId: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: RoleType;
  joinedAt: string;
}

interface MembershipRow {
  id: string;
  profile_id: string;
  role: RoleType;
  created_at: string;
  profiles: {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
}

function mapMembership(row: MembershipRow): OrgMember {
  return {
    membershipId: row.id,
    profileId: row.profile_id,
    fullName: row.profiles?.full_name ?? null,
    phone: row.profiles?.phone ?? null,
    avatarUrl: row.profiles?.avatar_url ?? null,
    role: row.role,
    joinedAt: row.created_at,
  };
}

/**
 * Cambia el rol de una membresía. La política membership_update solo deja
 * actuar a admins de la organización: PostgREST no da error si RLS bloquea,
 * actualiza 0 filas, así que comprobamos la fila devuelta.
 */
async function updateMemberRole(
  membershipId: string,
  role: RoleType
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('memberships')
    .update({ role })
    .eq('id', membershipId)
    .select('id');

  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) {
    return { success: false, error: 'No tienes permiso para cambiar roles.' };
  }
  return { success: true };
}

interface UseOrgMembersResult {
  members: OrgMember[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateRole: (
    membershipId: string,
    role: RoleType
  ) => Promise<{ success: boolean; error?: string }>;
}

export function useOrgMembers(organizationId: string): UseOrgMembersResult {
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
           profiles ( full_name, phone, avatar_url )`
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (fetchErr) {
        setError(fetchErr.message);
        setMembers([]);
        return;
      }

      setMembers(((data ?? []) as unknown as MembershipRow[]).map(mapMembership));
    } finally {
      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Actualiza en el servidor y, si salió bien, en el estado local (sin flash).
  const updateRole = useCallback(async (membershipId: string, role: RoleType) => {
    const result = await updateMemberRole(membershipId, role);
    if (result.success) {
      setMembers((prev) => prev.map((m) => (m.membershipId === membershipId ? { ...m, role } : m)));
    }
    return result;
  }, []);

  return { members, loading, error, refresh: fetchMembers, updateRole };
}

// ------------------------------------------------------------
// Opciones para crear una clase (tipos de clase y espacios)
// ------------------------------------------------------------

export interface ClassTypeOption {
  id: string;
  name: string;
  color: string;
}

export async function fetchClassTypes(
  organizationId: string
): Promise<{ data: ClassTypeOption[]; error?: string }> {
  if (!organizationId) return { data: [], error: 'Sin gimnasio asociado.' };

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('class_types')
    .select('id, name, color')
    .eq('organization_id', organizationId)
    .order('name');

  if (error) return { data: [], error: error.message };
  return { data: data ?? [] };
}

export interface SpaceOption {
  id: string;
  name: string;
  capacity: number;
  venueName: string | null;
}

interface SpaceRow {
  id: string;
  name: string;
  capacity: number;
  venues: { name: string } | null;
}

export async function fetchSpaces(
  organizationId: string
): Promise<{ data: SpaceOption[]; error?: string }> {
  if (!organizationId) return { data: [], error: 'Sin gimnasio asociado.' };

  const supabase = getSupabase();
  // spaces no tiene organization_id: el ámbito es spaces -> venues.
  const { data, error } = await supabase
    .from('spaces')
    .select('id, name, capacity, venues!inner ( name, organization_id )')
    .eq('venues.organization_id', organizationId)
    .order('name');

  if (error) return { data: [], error: error.message };

  return {
    data: ((data ?? []) as unknown as SpaceRow[]).map((s) => ({
      id: s.id,
      name: s.name,
      capacity: s.capacity,
      venueName: s.venues?.name ?? null,
    })),
  };
}

// ------------------------------------------------------------
// Dashboard: métricas, actividad reciente y próximas clases
// ------------------------------------------------------------

export interface DashboardStats {
  activeMembers: number;
  newMembersThisMonth: number;
  sessionsToday: number;
  /** Ocupación media (0-100) de los próximos 7 días; null si no hay clases. */
  occupancy7d: number | null;
  bookingsThisMonth: number;
  /** Ingresos del mes (pagos 'paid') en centavos + su moneda. */
  monthRevenueCents: number;
  monthRevenueCurrency: string | null;
}

export interface ActivityItem {
  id: string;
  icon: string;
  text: string;
  time: string;
}

export interface UpcomingClass {
  id: string;
  name: string;
  color: string;
  time: string;
  coach: string;
  spots: string;
}

interface UseDashboardResult {
  stats: DashboardStats | null;
  activity: ActivityItem[];
  upcoming: UpcomingClass[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const SESSION_SELECT = `
  id,
  starts_at,
  capacity_override,
  class_types!inner ( name, color ),
  spaces ( name, capacity, venues ( name ) ),
  coaches ( memberships ( profiles ( full_name ) ) )
`;

interface WeekSessionRow {
  id: string;
  starts_at: string;
  capacity_override: number | null;
  class_types: { name: string; color: string } | null;
  spaces: { name: string; capacity: number; venues: { name: string } | null } | null;
  coaches: {
    memberships: { profiles: { full_name: string | null } | null } | null;
  } | null;
}

interface RecentBookingRow {
  id: string;
  created_at: string;
  cancelled_at?: string | null;
  profiles: { full_name: string | null } | null;
  sessions: { class_types: { name: string } | null } | null;
}

interface NewMemberRow {
  id: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

/** Texto relativo en español: 'hace 5 min', 'hace 2 h', 'ayer'... */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

export function useDashboard(organizationId: string): UseDashboardResult {
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
        // Clases de hoy (ámbito vía class_types!inner, mismo patrón que useSchedule).
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
      if (firstError) setError(firstError);

      const weekRows = (weekSessionsRes.data ?? []) as unknown as WeekSessionRow[];

      // Reservas confirmadas por sesión (una sola consulta; RLS deja verlas al admin).
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

      const sessionCapacity = (s: WeekSessionRow) => s.capacity_override ?? s.spaces?.capacity ?? 0;

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
      const occupancy = capacitySum > 0 ? Math.round((bookedSum / capacitySum) * 100) : null;

      // Próximas 4 clases con sus cupos.
      const upcomingItems: UpcomingClass[] = weekRows.slice(0, 4).map((s) => ({
        id: s.id,
        name: s.class_types?.name ?? 'Clase',
        color: s.class_types?.color ?? '#0B9B91',
        time: new Date(s.starts_at).toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        coach: s.coaches?.memberships?.profiles?.full_name ?? 'Sin coach',
        spots: `${counts[s.id] ?? 0}/${sessionCapacity(s)}`,
      }));

      // Actividad reciente: reservas + cancelaciones + altas de miembros.
      type Timed = ActivityItem & { iso: string };
      const feed: Timed[] = [];

      for (const b of (recentConfirmedRes.data ?? []) as unknown as RecentBookingRow[]) {
        feed.push({
          id: `booking-${b.id}`,
          icon: '✅',
          text: `${b.profiles?.full_name ?? 'Alguien'} reservó «${b.sessions?.class_types?.name ?? 'una clase'}»`,
          time: '',
          iso: b.created_at,
        });
      }
      for (const b of (recentCancelledRes.data ?? []) as unknown as RecentBookingRow[]) {
        if (!b.cancelled_at) continue;
        feed.push({
          id: `cancel-${b.id}`,
          icon: '❌',
          text: `${b.profiles?.full_name ?? 'Alguien'} canceló «${b.sessions?.class_types?.name ?? 'una clase'}»`,
          time: '',
          iso: b.cancelled_at,
        });
      }
      for (const m of (newMembersRes.data ?? []) as unknown as NewMemberRow[]) {
        feed.push({
          id: `member-${m.id}`,
          icon: '👤',
          text: `Nuevo miembro: ${m.profiles?.full_name ?? 'sin nombre'}`,
          time: '',
          iso: m.created_at,
        });
      }

      const activityItems: ActivityItem[] = feed
        .sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime())
        .slice(0, 5)
        .map(({ iso, ...rest }) => ({ ...rest, time: timeAgo(iso) }));

      const revenueRows = (monthRevenueRes.data ?? []) as {
        amount_cents: number;
        currency: string;
      }[];

      setStats({
        activeMembers: membersTotalRes.count ?? 0,
        newMembersThisMonth: membersMonthRes.count ?? 0,
        sessionsToday: (todaySessionsRes.data ?? []).length,
        occupancy7d: occupancy,
        bookingsThisMonth: bookingsMonthRes.count ?? 0,
        monthRevenueCents: revenueRows.reduce((sum, r) => sum + r.amount_cents, 0),
        monthRevenueCurrency: revenueRows[0]?.currency ?? null,
      });
      setActivity(activityItems);
      setUpcoming(upcomingItems);
    } finally {
      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    stats,
    activity,
    upcoming,
    loading,
    error,
    refresh: fetchData,
  };
}

// ------------------------------------------------------------
// Gestión del gimnasio: tipos de clase, sedes y espacios.
// Sin esto el gym dependía del SQL Editor para cargar su contenido.
// RLS: class_types → admin/coach; venues/spaces → solo admin.
// ------------------------------------------------------------

export interface ClassTypeItem {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

export interface VenueItem {
  id: string;
  name: string;
  address: string | null;
}

export interface SpaceItem {
  id: string;
  venueId: string;
  name: string;
  capacity: number;
}

export type ActionResult = { success: boolean; error?: string };

interface UseGymContentResult {
  classTypes: ClassTypeItem[];
  venues: VenueItem[];
  spaces: SpaceItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createClassType: (input: {
    name: string;
    color: string;
    description?: string | null;
  }) => Promise<ActionResult>;
  deleteClassType: (id: string) => Promise<ActionResult>;
  createVenue: (input: { name: string; address?: string | null }) => Promise<ActionResult>;
  createSpace: (input: {
    venueId: string;
    name: string;
    capacity: number;
  }) => Promise<ActionResult>;
  deleteSpace: (id: string) => Promise<ActionResult>;
}

interface SpaceRowFull {
  id: string;
  venue_id: string;
  name: string;
  capacity: number;
}

export function useGymContent(organizationId: string): UseGymContentResult {
  const [classTypes, setClassTypes] = useState<ClassTypeItem[]>([]);
  const [venues, setVenues] = useState<VenueItem[]>([]);
  const [spaces, setSpaces] = useState<SpaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const startedAt = Date.now();
    setLoading(true);
    setError(null);

    try {
      if (!organizationId) {
        setClassTypes([]);
        setVenues([]);
        setSpaces([]);
        return;
      }

      const supabase = getSupabase();
      const [classTypesRes, venuesRes, spacesRes] = await Promise.all([
        supabase
          .from('class_types')
          .select('id, name, color, description')
          .eq('organization_id', organizationId)
          .order('name'),
        supabase
          .from('venues')
          .select('id, name, address')
          .eq('organization_id', organizationId)
          .order('name'),
        // spaces no tiene organization_id: el ámbito es spaces -> venues.
        supabase
          .from('spaces')
          .select('id, venue_id, name, capacity, venues!inner ( organization_id )')
          .eq('venues.organization_id', organizationId)
          .order('name'),
      ]);

      const firstError =
        classTypesRes.error?.message ?? venuesRes.error?.message ?? spacesRes.error?.message;
      if (firstError) {
        setError(firstError);
        return;
      }

      setClassTypes((classTypesRes.data ?? []) as ClassTypeItem[]);
      setVenues((venuesRes.data ?? []) as VenueItem[]);
      setSpaces(
        ((spacesRes.data ?? []) as unknown as SpaceRowFull[]).map((s) => ({
          id: s.id,
          venueId: s.venue_id,
          name: s.name,
          capacity: s.capacity,
        }))
      );
    } finally {
      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createClassType = useCallback(
    async (input: { name: string; color: string; description?: string | null }) => {
      const supabase = getSupabase();
      const { error: insertErr } = await supabase.from('class_types').insert({
        organization_id: organizationId,
        name: input.name.trim(),
        color: input.color,
        description: input.description?.trim() ? input.description.trim() : null,
      });

      if (insertErr) return { success: false, error: insertErr.message };
      await fetchData();
      return { success: true };
    },
    [organizationId, fetchData]
  );

  // Ojo con los CASCADE: borrar un tipo/espacio con clases programadas
  // borraría sus sesiones (y de ahí reservas). Se comprueba antes.
  const deleteClassType = useCallback(
    async (id: string): Promise<ActionResult> => {
      const supabase = getSupabase();
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('class_type_id', id)
        .limit(1);

      if (sessions && sessions.length > 0) {
        return {
          success: false,
          error: 'Este tipo tiene clases programadas. Elimina esas clases antes.',
        };
      }

      const { error: deleteErr } = await supabase
        .from('class_types')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (deleteErr) return { success: false, error: deleteErr.message };
      await fetchData();
      return { success: true };
    },
    [organizationId, fetchData]
  );

  const createVenue = useCallback(
    async (input: { name: string; address?: string | null }) => {
      const supabase = getSupabase();
      const { error: insertErr } = await supabase.from('venues').insert({
        organization_id: organizationId,
        name: input.name.trim(),
        address: input.address?.trim() ? input.address.trim() : null,
      });

      if (insertErr) return { success: false, error: insertErr.message };
      await fetchData();
      return { success: true };
    },
    [organizationId, fetchData]
  );

  const createSpace = useCallback(
    async (input: { venueId: string; name: string; capacity: number }) => {
      const supabase = getSupabase();
      const { error: insertErr } = await supabase.from('spaces').insert({
        venue_id: input.venueId,
        name: input.name.trim(),
        capacity: input.capacity,
      });

      if (insertErr) return { success: false, error: insertErr.message };
      await fetchData();
      return { success: true };
    },
    [fetchData]
  );

  // PostgREST no da error si RLS impide el delete: afecta 0 filas.
  // .select('id') devuelve las filas borradas → 0 significa "sin permiso".
  const deleteSpace = useCallback(
    async (id: string): Promise<ActionResult> => {
      const supabase = getSupabase();
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('space_id', id)
        .limit(1);

      if (sessions && sessions.length > 0) {
        return {
          success: false,
          error: 'Este espacio tiene clases programadas. Elimina esas clases antes.',
        };
      }

      const { data: deleted, error: deleteErr } = await supabase
        .from('spaces')
        .delete()
        .eq('id', id)
        .select('id');

      if (deleteErr) return { success: false, error: deleteErr.message };
      if (!deleted || deleted.length === 0) {
        return { success: false, error: 'No tienes permiso para eliminar espacios.' };
      }

      await fetchData();
      return { success: true };
    },
    [fetchData]
  );

  return {
    classTypes,
    venues,
    spaces,
    loading,
    error,
    refresh: fetchData,
    createClassType,
    deleteClassType,
    createVenue,
    createSpace,
    deleteSpace,
  };
}
