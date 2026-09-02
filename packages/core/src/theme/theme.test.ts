import { describe, expect, it } from 'vitest';
import { colors, fonts, spacing, theme } from '../index';

describe('theme', () => {
  it('exposes the brand palette from the manual', () => {
    expect(colors.azulNexo).toBe('#06354E');
    expect(colors.turquesa).toBe('#0B9B91');
    expect(colors.mentaActiva).toBe('#16B9A9');
    expect(colors.limaProgreso).toBe('#A9F56F');
    expect(colors.crema).toBe('#F8F6EF');
  });

  it('references the brand typography', () => {
    expect(fonts.brand).toContain('Nunito');
    expect(fonts.uiRegular).toContain('Inter');
  });

  it('provides usable spacing', () => {
    expect(spacing.md).toBe(16);
  });

  it('assembles a theme object', () => {
    expect(theme.colors.azulNexo).toBe('#06354E');
    expect(theme.shadow.color).toBe('#06354E');
    expect(theme.shadow.opacity).toBe(0.2);
  });
});
