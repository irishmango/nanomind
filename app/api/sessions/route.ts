import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sessions')
    .select('id, title, created_at, materials(name)')
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { title, material_id } = body

  const { data, error } = await supabase
    .from('sessions')
    .insert({ title, material_id })
    .select('id')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
