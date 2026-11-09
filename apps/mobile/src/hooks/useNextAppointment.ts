import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@nexofit/core';
import { fetchNextAppointment, type NextAppointment } from '../utils/appointments';

/** Próxima cita del miembro para el resumen de Inicio. Un fallo deja `null`. */
export function useNextAppointment(profileId: string | undefined) {
  const [next, setNext] = useState<NextAppointment | null>(null);

  const refresh = useCallback(async () => {
    if (!profileId) {
      setNext(null);
      return;
    }
    try {
      setNext(await fetchNextAppointment(getSupabase(), profileId));
    } catch (cause) {
      // El resumen es secundario: si falla, Inicio simplemente no lo muestra.
      console.warn('next appointment failed', cause);
      setNext(null);
    }
  }, [profileId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { next, refresh };
}
