/** Dirección en la que un cambio cuenta como mejora para cada medida. */
export type GoodDirection = 'down' | 'up' | 'neutral';

export const METRIC_DIRECTION: Record<string, GoodDirection> = {
  Peso: 'down',
  'Grasa corporal': 'down',
  Cintura: 'down',
  'Masa muscular': 'up',
};

interface MeasurementLike {
  measured_at: string;
  measurement_values: { metric_name: string; value_numeric: number | string }[];
}

/**
 * Valores de una medida en orden cronológico (más antiguo primero), tomando
 * las `limit` mediciones más recientes. `measurements` viene del más nuevo al
 * más viejo, como lo devuelve useBodyMetrics.
 */
export function metricSeries(
  measurements: readonly MeasurementLike[],
  name: string,
  limit = 8
): number[] {
  const values: number[] = [];
  for (const measurement of measurements) {
    const found = measurement.measurement_values.find((value) => value.metric_name === name);
    if (found == null) continue;
    const numeric = Number(found.value_numeric);
    if (!Number.isFinite(numeric)) continue;
    values.push(numeric);
    if (values.length === limit) break;
  }
  return values.reverse();
}

export type TrendTone = 'good' | 'bad' | 'neutral';

/** Cambio entre el primer y el último valor de la serie, y si es mejora. */
export function seriesTrend(
  series: readonly number[],
  direction: GoodDirection = 'neutral'
): { delta: number; tone: TrendTone } | null {
  if (series.length < 2) return null;
  const delta = Math.round((series[series.length - 1] - series[0]) * 10) / 10;
  if (delta === 0 || direction === 'neutral') return { delta, tone: 'neutral' };
  const improved = direction === 'down' ? delta < 0 : delta > 0;
  return { delta, tone: improved ? 'good' : 'bad' };
}

/** «+1.5» / «−4.0» / «0». */
export function formatDelta(delta: number): string {
  if (delta === 0) return '0';
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}`;
}
