import { createClient } from '@supabase/supabase-js'


const supabaseUrl = 'https://trrnqodnziunneyjaimo.supabase.co'
const supabaseKey = 'sb_publishable_hKoNb7riWuHfX0p3IU5urg_CRmcole7'

export const supabase = createClient(supabaseUrl, supabaseKey)