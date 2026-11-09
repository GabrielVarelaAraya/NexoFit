import { describe, expect, it } from 'vitest';
import { greeting, greetingName } from './greeting';

describe('greetingName', () => {
  it('uses the first name of the profile', () => {
    expect(greetingName('Gabriel Varela', 'gabo@mail.com')).toBe('Gabriel');
  });

  it('ignores extra whitespace', () => {
    expect(greetingName('  Sofía   Lizano ', null)).toBe('Sofía');
  });

  it('falls back to the email local part when there is no name', () => {
    expect(greetingName('', 'gabo@mail.com')).toBe('gabo');
    expect(greetingName(null, 'gabo@mail.com')).toBe('gabo');
  });

  it('never returns an empty string', () => {
    expect(greetingName(undefined, undefined)).toBe('de nuevo');
  });
});

describe('greeting', () => {
  it('builds the header text', () => {
    expect(greeting('Gabriel Varela', 'gabo@mail.com')).toBe('Hola, Gabriel');
  });
});
