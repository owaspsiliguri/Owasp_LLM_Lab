// Supabase client for authentication and data.
//
// Authentication is active only when the deployment provides Supabase
// credentials (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY). Without them the
// app runs in local mode: no login screen, progress stays in localStorage,
// which keeps `docker compose up` fully working offline.
import { createClient } from '@supabase/supabase-js'

export function isAuthEnabled() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

let client = null

export function supabase() {
  if (!isAuthEnabled()) return null
  if (!client) {
    client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}
