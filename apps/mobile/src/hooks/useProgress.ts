import { useState, useCallback, useEffect } from 'react';
import { getSupabase } from '@nexofit/core';
import type { MeasurementRow, MeasurementValueRow } from '@nexofit/core';
import { holdLoading } from '../utils/loading';

export type BodyMetric = {
  name: string;
  value: number;
  unit: string;
};

export type MeasurementWithValues = MeasurementRow & {
  measurement_values: MeasurementValueRow[];
};

interface UseBodyMetricsResult {
  measurements: MeasurementWithValues[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addMeasurement: (data: {
    measured_at: string;
    metrics: BodyMetric[];
    source?: 'manual' | 'inbody' | 'other';
    notes?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  deleteMeasurement: (id: string) => Promise<{ success: boolean; error?: string }>;
  getLatestMetrics: () => BodyMetric[];
}

export function useBodyMetrics(profileId: string, organizationId?: string): UseBodyMetricsResult {
  const [measurements, setMeasurements] = useState<MeasurementWithValues[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = getSupabase();

  const fetchMeasurements = useCallback(async () => {
    const startedAt = Date.now();
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchErr } = await supabase
        .from('measurements')
        .select(
          `
          id,
          organization_id,
          profile_id,
          measured_at,
          source,
          notes,
          created_at,
          measurement_values ( id, measurement_id, metric_name, value_numeric, unit )
        `
        )
        .eq('profile_id', profileId)
        .order('measured_at', { ascending: false });

      if (fetchErr) {
        setError(fetchErr.message);
      } else {
        setMeasurements((data as unknown as MeasurementWithValues[]) ?? []);
      }
    } finally {
      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [profileId]);

  const addMeasurement = useCallback(
    async (data: {
      measured_at: string;
      metrics: BodyMetric[];
      source?: 'manual' | 'inbody' | 'other';
      notes?: string;
    }) => {
      try {
        const { data: measurement, error: measError } = await supabase
          .from('measurements')
          .insert({
            organization_id: organizationId ?? null,
            profile_id: profileId,
            measured_at: data.measured_at,
            source: data.source ?? 'manual',
            notes: data.notes ?? null,
          })
          .select('id')
          .single();

        if (measError) throw measError;

        const metricValues = data.metrics.map((m) => ({
          measurement_id: measurement.id,
          metric_name: m.name,
          value_numeric: m.value,
          unit: m.unit,
        }));

        const { error: valuesError } = await supabase
          .from('measurement_values')
          .insert(metricValues);

        if (valuesError) throw valuesError;

        // Refrescar la lista: sin esto la pantalla queda con datos viejos y
        // parece que la medida no se guardó.
        await fetchMeasurements();

        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Error al guardar' };
      }
    },
    [profileId, organizationId, fetchMeasurements]
  );

  const deleteMeasurement = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase.from('measurements').delete().eq('id', id);

        if (error) throw error;

        await fetchMeasurements();

        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Error al eliminar' };
      }
    },
    [fetchMeasurements]
  );

  const getLatestMetrics = useCallback((): BodyMetric[] => {
    const latest = measurements[0];
    if (!latest) return [];
    return latest.measurement_values.map((m) => ({
      name: m.metric_name,
      value: m.value_numeric,
      unit: m.unit ?? '',
    }));
  }, [measurements]);

  useEffect(() => {
    fetchMeasurements();
  }, [fetchMeasurements]);

  return {
    measurements,
    loading,
    error,
    refresh: fetchMeasurements,
    addMeasurement,
    deleteMeasurement,
    getLatestMetrics,
  };
}

interface UseSettingsResult {
  profile: { full_name?: string; avatar_url?: string; email: string } | null;
  loading: boolean;
  error: string | null;
  updateProfile: (data: {
    full_name?: string;
    avatar_url?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
}

export function useSettings(profileId: string): UseSettingsResult {
  const [profile, setProfile] = useState<{
    full_name?: string;
    avatar_url?: string;
    email: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = getSupabase();

  const fetchProfile = useCallback(async () => {
    setLoading(true);

    const [{ data: rowData, error: rowErr }, { data: authData }] = await Promise.all([
      supabase.from('profiles').select('full_name, avatar_url').eq('id', profileId).maybeSingle(),
      supabase.auth.getUser(),
    ]);

    if (rowErr) {
      setError(rowErr.message);
    } else {
      setProfile({
        full_name: rowData?.full_name ?? undefined,
        avatar_url: rowData?.avatar_url ?? undefined,
        email: authData.user?.email ?? '',
      });
    }
    setLoading(false);
  }, [profileId]);

  const updateProfile = useCallback(
    async (data: { full_name?: string; avatar_url?: string }) => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: data.full_name ?? null, avatar_url: data.avatar_url ?? null })
          .eq('id', profileId);

        if (error) throw error;

        await fetchProfile();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Error al actualizar',
        };
      }
    },
    [profileId, fetchProfile]
  );

  const changePassword = useCallback(async (_currentPassword: string, newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error al cambiar contraseña',
      };
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      const { error } = await supabase.auth.admin.deleteUser(profileId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error al eliminar cuenta',
      };
    }
  }, [profileId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, updateProfile, changePassword, deleteAccount };
}
