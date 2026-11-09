import { describe, expect, it } from 'vitest';
import { formatDelta, metricSeries, seriesTrend } from './progress';

const m = (date: string, values: Record<string, number>) => ({
  measured_at: date,
  measurement_values: Object.entries(values).map(([metric_name, value_numeric]) => ({
    metric_name,
    value_numeric,
  })),
});

// Del más nuevo al más viejo, como useBodyMetrics.
const measurements = [
  m('2026-10-06', { Peso: 94, 'Masa muscular': 58 }),
  m('2026-10-04', { Peso: 98 }),
  m('2026-09-01', { Peso: 100, 'Masa muscular': 60 }),
];

describe('metricSeries', () => {
  it('returns values oldest first, skipping measurements without the metric', () => {
    expect(metricSeries(measurements, 'Peso')).toEqual([100, 98, 94]);
    expect(metricSeries(measurements, 'Masa muscular')).toEqual([60, 58]);
  });

  it('keeps only the most recent values when limited', () => {
    expect(metricSeries(measurements, 'Peso', 2)).toEqual([98, 94]);
  });

  it('accepts numeric strings from Postgres', () => {
    const fromDb = [
      { measured_at: '2026-10-06', measurement_values: [] },
      {
        measured_at: '2026-10-01',
        measurement_values: [{ metric_name: 'Peso', value_numeric: '70.5' }],
      },
    ];
    expect(metricSeries(fromDb, 'Peso')).toEqual([70.5]);
  });
});

describe('seriesTrend', () => {
  it('marks losing weight as good', () => {
    expect(seriesTrend([100, 94], 'down')).toEqual({ delta: -6, tone: 'good' });
  });

  it('marks losing muscle as bad', () => {
    expect(seriesTrend([60, 58], 'up')).toEqual({ delta: -2, tone: 'bad' });
  });

  it('is neutral for no change or neutral metrics, and null without history', () => {
    expect(seriesTrend([90, 90], 'down')).toEqual({ delta: 0, tone: 'neutral' });
    expect(seriesTrend([90, 85], 'neutral')?.tone).toBe('neutral');
    expect(seriesTrend([90])).toBeNull();
  });
});

describe('formatDelta', () => {
  it('formats with sign and one decimal', () => {
    expect(formatDelta(-4)).toBe('−4.0');
    expect(formatDelta(1.25)).toBe('+1.3');
    expect(formatDelta(0)).toBe('0');
  });
});
