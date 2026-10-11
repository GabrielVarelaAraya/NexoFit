import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getSupabase } from '@nexofit/core';
import { useAuth } from '../contexts/AuthContext';
import { fetchProfessionalWorkspace, type ProfessionalWorkspace } from '../utils/professional';

export function useProfessional(includeSchedule = true) {
  const { membership } = useAuth();
  const membershipId = membership?.id;
  const organizationId = membership?.organization_id;
  const role = membership?.role;
  const requestId = useRef(0);
  const [workspace, setWorkspace] = useState<ProfessionalWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      if (!membershipId || !organizationId || role !== 'professional')
        throw new Error('No tienes una membresía profesional activa.');
      const data = await fetchProfessionalWorkspace(
        getSupabase(),
        membershipId,
        organizationId,
        includeSchedule
      );
      if (request === requestId.current) setWorkspace(data);
    } catch (cause) {
      if (request === requestId.current) {
        setWorkspace(null);
        setError(
          cause instanceof Error ? cause.message : 'No pudimos cargar tu información profesional.'
        );
      }
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [membershipId, organizationId, role, includeSchedule]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        requestId.current += 1;
      };
    }, [refresh])
  );
  return { workspace, loading, error, refresh };
}
