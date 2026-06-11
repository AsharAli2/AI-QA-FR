import { createClient } from '@supabase/supabase-js';

// Client-side Supabase: uses the ANON key. Row Level Security on the database
// ensures a logged-in user can only read/write their own rows. The service_role
// key is NEVER used here — it lives only on the server/agent.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.',
  );
}

export const supabase = createClient(url, anonKey);
