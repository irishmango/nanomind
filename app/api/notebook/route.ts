import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const session_id = searchParams.get('session_id')
  const material_id = searchParams.get('material_id')
  const technique = searchParams.get('technique')
  const confidence = searchParams.get('confidence')

  const supabase = await createClient()

  let query = supabase
    .from('notebook_entries')
    .select(`
      id, technique, finding, confidence, source, created_at,
      materials(id, name, formula),
      sessions(id, title)
    `)
    .order('created_at', { ascending: false })

  if (session_id) query = query.eq('session_id', session_id)
  if (material_id) query = query.eq('material_id', material_id)
  if (technique) query = query.eq('technique', technique)
  if (confidence) query = query.eq('confidence', confidence)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { session_id, material_id, technique, finding, confidence, source } = body

  if (!finding) {
    return Response.json({ error: 'finding is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notebook_entries')
    .insert({ session_id, material_id, technique, finding, confidence, source })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('notebook_entries').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
