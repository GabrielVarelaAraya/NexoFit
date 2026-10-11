import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabase, setSupabaseConfig } from './client';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
}
const user = {
  id: 'test-user',
  aud: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-10-09',
};
const jwt = () =>
  [
    btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=+$/, ''),
    btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 7200 })).replace(
      /=+$/,
      ''
    ),
    btoa('test-signature').replace(/=+$/, ''),
  ].join('.');

afterEach(() => {
  vi.unstubAllGlobals();
  setSupabaseConfig({ url: '', key: '' });
});

describe('Supabase session storage', () => {
  it.each([false, true])('restores after client recreation; signed out = %s', async (signedOut) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (url: string) =>
          new Response(String(url).includes('/logout') ? null : JSON.stringify({ ...user }), {
            status: String(url).includes('/logout') ? 204 : 200,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    );
    const storage = createStorage();
    const config = {
      url: 'https://persistence-test.supabase.co',
      key: 'public-test-key',
      auth: { storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    };
    setSupabaseConfig(config);
    const original = getSupabase();
    expect(
      (await original.auth.setSession({ access_token: jwt(), refresh_token: 'refresh-test' })).error
    ).toBeNull();
    if (signedOut) expect((await original.auth.signOut({ scope: 'local' })).error).toBeNull();
    setSupabaseConfig(config);
    const restarted = getSupabase();
    const { data, error } = await restarted.auth.getSession();
    expect(error).toBeNull();
    if (signedOut) expect(data.session).toBeNull();
    else expect(data.session?.user.id).toBe(user.id);
  });
});
