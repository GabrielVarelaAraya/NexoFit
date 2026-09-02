import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let _client: SupabaseClient<Database> | null = null;

/**
 * Returns the Supabase client, creating it on first access.
 * Environment variables EXPO_PUBLIC_SUPABASE_URL and
 * EXPO_PUBLIC_SUPABASE_ANON_KEY must be set at runtime.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!_client) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
    _client = createClient<Database>(url, key);
  }
  return _client;
}
