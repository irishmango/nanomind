import { createClient } from '@/lib/supabase/server'

// GET /api/documents?session_id=<id>
// Returns one row per unique filename with chunk count and earliest created_at
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const session_id = searchParams.get('session_id')

  if (!session_id) {
    return Response.json({ error: 'session_id is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .select('filename, created_at')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Aggregate: one row per filename
  const map = new Map<string, { filename: string; created_at: string; chunk_count: number }>()
  for (const row of data ?? []) {
    if (!map.has(row.filename)) {
      map.set(row.filename, { filename: row.filename, created_at: row.created_at, chunk_count: 0 })
    }
    map.get(row.filename)!.chunk_count++
  }

  return Response.json([...map.values()])
}

// DELETE /api/documents?session_id=<id>&filename=<name>
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const session_id = searchParams.get('session_id')
  const filename = searchParams.get('filename')

  if (!session_id || !filename) {
    return Response.json({ error: 'session_id and filename are required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('session_id', session_id)
    .eq('filename', filename)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
