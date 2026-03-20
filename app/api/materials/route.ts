import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const body = await req.json()

  const { name, formula, tags } = body as {
    name: string
    formula?: string
    tags?: string[]
  }

  if (!name?.trim()) {
    return Response.json({ error: 'name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('materials')
    .insert({ name: name.trim(), formula: formula?.trim() || null, tags: tags ?? [] })
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
