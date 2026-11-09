import { describe, expect, it } from 'vitest';
import { documentTitleFor } from './documentTitle';

describe('documentTitleFor', () => {
  it('uses the Spanish label for known routes', () => {
    expect(documentTitleFor('Mas')).toBe('Más · NexoFit');
    expect(documentTitleFor('AgendaProfesional', 'Agenda')).toBe('Mi agenda · NexoFit');
  });

  it('falls back to the screen title for unknown routes', () => {
    expect(documentTitleFor('Nueva', 'Algo nuevo')).toBe('Algo nuevo · NexoFit');
  });

  it('never shows undefined', () => {
    expect(documentTitleFor(undefined, undefined)).toBe('NexoFit');
    expect(documentTitleFor('Desconocida', '  ')).toBe('NexoFit');
  });
});
