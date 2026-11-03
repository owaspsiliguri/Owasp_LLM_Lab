import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Tests always run in local mode, whatever credentials sit in .env.local.
vi.stubEnv('VITE_SUPABASE_URL', '')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

afterEach(() => { cleanup(); localStorage.clear() })
