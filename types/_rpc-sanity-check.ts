import type { Database } from './supabase-types'

type _Args = Database['public']['Functions']['apply_supplier_verification_event']['Args']
type _Check = _Args extends Record<string, unknown> ? true : false
export type Sanity = [_Args, _Check]
