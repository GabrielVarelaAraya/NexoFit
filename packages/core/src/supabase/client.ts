import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let _client: SupabaseClient<Database> | null = null;
let _config: { url: string; key: string } | null = null;

/**
 * Set the Supabase configuration. Must be called before getSupabase().
 * In Expo apps, call this with values from expo-constants.
 * In Node scripts, you can use process.env directly.
 */
export function setSupabaseConfig(config: { url: string; key: string }): void {
  _config = config;
  // Reset client so it gets recreated with new config
  _client = null;
}

/**
 * Returns the Supabase client, creating it on first access.
 * Call setSupabaseConfig() first in Expo apps, or ensure
 * EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
 * are set in process.env for Node environments.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!_client) {
    const url = _config?.url ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    const key = _config?.key ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

    if (!url || !key) {
      throw new Error(
        'Supabase config not set. Call setSupabaseConfig({ url, key }) in your app entry point, ' +
          'or set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.'
      );
    }

    _client = createClient<Database>(url, key);
  }
  return _client;
}
