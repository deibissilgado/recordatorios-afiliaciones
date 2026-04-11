import { createClient } from '@supabase/supabase-js'

// Permite usar variables de entorno en Vercel/local sin romper tu configuración actual.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://trrnqodnziunneyjaimo.supabase.co'
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_hKoNb7riWuHfX0p3IU5urg_CRmcole7'

export const supabase = createClient(supabaseUrl, supabaseKey)
