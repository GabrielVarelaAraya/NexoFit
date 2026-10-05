import { useState, useCallback, useEffect } from 'react';
import { getSupabase } from '@nexofit/core';
import { holdLoading } from '../utils/loading';

// ============================================================
// Stage 5 · Pagos: planes de membresía + libro de cobros.
// El admin registra pagos recibidos (efectivo/transferencia/tarjeta);
// el miembro ve su plan vigente e historial. Ledger preparado para
// Stripe escribiría sobre estas mismas tablas más adelante.
// ============================================================

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'other';

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
};

export const STATUS_LABELS: Record<string, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  refunded: 'Reembolsado',
};

export interface PlanItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  durationDays: number;
  active: boolean;
}

export interface PaymentItem {
  id: string;
  amountCents: number;
  currency: string;
  method: string;
  status: string;
  paidAt: string;
  notes: string | null;
  memberName: string | null;
  planName: string | null;
}

/** Centavos enteros → 'USD $1 234,56' / 'CRC ₡15 000'. */
export function formatMoney(cents: number, currency: string | null): string {
  const amount = cents / 100;
  const symbol = currency === 'CRC' ? '₡' : currency === 'EUR' ? '€' : '$';
  const formatted = amount.toLocaleString('es-CR', { maximumFractionDigits: 2 });
  return `${symbol}${formatted}`;
}

/** Fecha corta en español: '15 oct 2026'. */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface PaymentRowShape {
  id: string;
  amount_cents: number;
  currency: string;
  method: string;
  status: string;
  paid_at: string;
  notes: string | null;
  profiles: { full_name: string | null } | null;
  membership_plans: { name: string } | null;
}

interface PlanRowShape {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  duration_days: number;
  active: boolean;
}

function mapPayment(row: PaymentRowShape): PaymentItem {
  return {
    id: row.id,
    amountCents: row.amount_cents,
    currency: row.currency,
    method: row.method,
    status: row.status,
    paidAt: row.paid_at,
    notes: row.notes,
    memberName: row.profiles?.full_name ?? null,
    planName: row.membership_plans?.name ?? null,
  };
}

function mapPlan(row: PlanRowShape): PlanItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
    durationDays: row.duration_days,
    active: row.active,
  };
}

export interface RegisterPaymentInput {
  organizationId: string;
  profileId: string;
  planId: string | null;
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  notes?: string | null;
  createdBy: string | null;
}

export interface CreatePlanInput {
  organizationId: string;
  name: string;
  description?: string | null;
  priceCents: number;
  currency: string;
  durationDays: number;
}

interface UsePaymentsResult {
  payments: PaymentItem[];
  plans: PlanItem[];
  /** Suma de pagos 'paid' del mes en curso (mes local). */
  monthRevenueCents: number;
  monthCurrency: string | null;
  monthCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  registerPayment: (input: RegisterPaymentInput) => Promise<{ success: boolean; error?: string }>;
  createPlan: (input: CreatePlanInput) => Promise<{ success: boolean; error?: string }>;
  archivePlan: (planId: string) => Promise<{ success: boolean; error?: string }>;
}

export function usePayments(organizationId: string): UsePaymentsResult {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [monthRevenueCents, setMonthRevenueCents] = useState(0);
  const [monthCurrency, setMonthCurrency] = useState<string | null>(null);
  const [monthCount, setMonthCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const startedAt = Date.now();
    setLoading(true);
    setError(null);

    try {
      if (!organizationId) {
        setPayments([]);
        setPlans([]);
        setMonthRevenueCents(0);
        setMonthCurrency(null);
        setMonthCount(0);
        return;
      }

      const supabase = getSupabase();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [paymentsRes, plansRes, monthRes] = await Promise.all([
        supabase
          .from('payments')
          .select(
            `id, amount_cents, currency, method, status, paid_at, notes,
             profiles ( full_name ),
             membership_plans ( name )`
          )
          .eq('organization_id', organizationId)
          .order('paid_at', { ascending: false })
          .limit(50),
        supabase
          .from('membership_plans')
          .select('id, name, description, price_cents, currency, duration_days, active')
          .eq('organization_id', organizationId)
          .order('name'),
        // Ingresos del mes: una consulta aparte para no depender del límite
        // de 50 del histórico.
        supabase
          .from('payments')
          .select('amount_cents, currency')
          .eq('organization_id', organizationId)
          .eq('status', 'paid')
          .gte('paid_at', monthStart),
      ]);

      if (paymentsRes.error || plansRes.error || monthRes.error) {
        setError(
          paymentsRes.error?.message ??
            plansRes.error?.message ??
            monthRes.error?.message ??
            'Error al cargar pagos.'
        );
        return;
      }

      setPayments(((paymentsRes.data ?? []) as unknown as PaymentRowShape[]).map(mapPayment));
      setPlans(((plansRes.data ?? []) as unknown as PlanRowShape[]).map(mapPlan));

      const monthRows = (monthRes.data ?? []) as { amount_cents: number; currency: string }[];
      setMonthRevenueCents(monthRows.reduce((sum, r) => sum + r.amount_cents, 0));
      setMonthCount(monthRows.length);
      setMonthCurrency(monthRows[0]?.currency ?? null);
    } finally {
      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const registerPayment = useCallback(
    async (input: RegisterPaymentInput) => {
      const supabase = getSupabase();
      const { error: insertErr } = await supabase.from('payments').insert({
        organization_id: input.organizationId,
        profile_id: input.profileId,
        plan_id: input.planId,
        amount_cents: input.amountCents,
        currency: input.currency,
        method: input.method,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        created_by: input.createdBy,
        status: 'paid',
      });

      if (insertErr) return { success: false, error: insertErr.message };
      await fetchData();
      return { success: true };
    },
    [fetchData]
  );

  const createPlan = useCallback(
    async (input: CreatePlanInput) => {
      const supabase = getSupabase();
      const { error: insertErr } = await supabase.from('membership_plans').insert({
        organization_id: input.organizationId,
        name: input.name.trim(),
        description: input.description?.trim() ? input.description.trim() : null,
        price_cents: input.priceCents,
        currency: input.currency,
        duration_days: input.durationDays,
      });

      if (insertErr) {
        // 23505 = UNIQUE(organization_id, name): el plan ya existe.
        if (insertErr.code === '23505') {
          return { success: false, error: 'Ya existe un plan con ese nombre.' };
        }
        return { success: false, error: insertErr.message };
      }
      await fetchData();
      return { success: true };
    },
    [fetchData]
  );

  // Archivar = active false (el histórico de pagos conserva el plan).
  const archivePlan = useCallback(
    async (planId: string) => {
      const supabase = getSupabase();
      const { error: updateErr } = await supabase
        .from('membership_plans')
        .update({ active: false })
        .eq('id', planId)
        .eq('organization_id', organizationId);

      if (updateErr) return { success: false, error: updateErr.message };
      await fetchData();
      return { success: true };
    },
    [organizationId, fetchData]
  );

  return {
    payments,
    plans,
    monthRevenueCents,
    monthCurrency,
    monthCount,
    loading,
    error,
    refresh: fetchData,
    registerPayment,
    createPlan,
    archivePlan,
  };
}

// ------------------------------------------------------------
// Lado miembro: mis pagos + plan vigente
// ------------------------------------------------------------

export interface MyPayment {
  id: string;
  amountCents: number;
  currency: string;
  method: string;
  status: string;
  paidAt: string;
  planName: string | null;
  durationDays: number | null;
}

export interface CurrentPlan {
  planName: string;
  paidAt: string;
  /** paid_at + duration_days del plan (ISO). */
  validUntil: string;
}

interface MyPaymentRow {
  id: string;
  amount_cents: number;
  currency: string;
  method: string;
  status: string;
  paid_at: string;
  membership_plans: { name: string; duration_days: number } | null;
}

/**
 * Historial de pagos del miembro y su plan vigente (el último pago 'paid'
 * con plan define vigencia = paid_at + duration_days).
 */
export async function fetchMyPayments(profileId: string): Promise<{
  payments: MyPayment[];
  currentPlan: CurrentPlan | null;
  error?: string;
}> {
  if (!profileId) return { payments: [], currentPlan: null, error: 'Sin perfil.' };

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('payments')
    .select(
      `id, amount_cents, currency, method, status, paid_at,
       membership_plans ( name, duration_days )`
    )
    .eq('profile_id', profileId)
    .order('paid_at', { ascending: false })
    .limit(30);

  if (error) return { payments: [], currentPlan: null, error: error.message };

  const rows = (data ?? []) as unknown as MyPaymentRow[];
  const payments: MyPayment[] = rows.map((r) => ({
    id: r.id,
    amountCents: r.amount_cents,
    currency: r.currency,
    method: r.method,
    status: r.status,
    paidAt: r.paid_at,
    planName: r.membership_plans?.name ?? null,
    durationDays: r.membership_plans?.duration_days ?? null,
  }));

  const latest = payments.find((p) => p.status === 'paid' && p.planName && p.durationDays) ?? null;

  let currentPlan: CurrentPlan | null = null;
  if (latest && latest.durationDays) {
    const validUntil = new Date(latest.paidAt);
    validUntil.setDate(validUntil.getDate() + latest.durationDays);
    currentPlan = {
      planName: latest.planName as string,
      paidAt: latest.paidAt,
      validUntil: validUntil.toISOString(),
    };
  }

  return { payments, currentPlan };
}
