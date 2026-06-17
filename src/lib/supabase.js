import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Org ID for Whiteladies Medical — single-tenant for now.
// When multi-tenant, resolve from auth session instead.
export const ORG_ID = 'a1000000-0000-0000-0000-000000000001'
