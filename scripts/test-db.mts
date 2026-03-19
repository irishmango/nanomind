import { createClient } from '@supabase/supabase-js'

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const { data, error } = await client.from('materials').select('*')
console.log(data, error)
