import { createClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from './connectivity';

/**
 * Service-role Supabase client for trusted server-side admin operations.
 * ONLY use in server-side code (server actions, API routes).
 * Bypasses all RLS policies.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: fetchWithTimeout,
      },
    }
  );
}
