import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sessions')
    .select('*, messages(id, role, content, created_at)')
    .eq('id', id)
    .order('created_at', { referencedTable: 'messages', ascending: true })
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return Response.json({ error: error.message }, { status })
  }

  return Response.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { title } = await req.json()
  const supabase = await createClient()

  const { error } = await supabase.from('sessions').update({ title }).eq('id', id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  // notebook_entries has no ON DELETE CASCADE on its session_id FK, so clear it first
  const { error: nbError } = await supabase
    .from('notebook_entries')
    .delete()
    .eq('session_id', id)

  if (nbError) {
    return Response.json({ error: nbError.message }, { status: 500 })
  }

  const { error } = await supabase.from('sessions').delete().eq('id', id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
