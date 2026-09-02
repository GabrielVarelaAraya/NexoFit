import { describe, expect, it } from 'vitest';
import { DB_PACKAGE, migrationVersion } from './index';

describe('db package', () => {
  it('exposes its name', () => {
    expect(DB_PACKAGE).toBe('@nexofit/db');
  });

  it('reports a migration version', () => {
    expect(migrationVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
