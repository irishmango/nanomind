import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf'
import { createClient } from '@/lib/supabase/server'
import { chunkText } from '@/lib/chunker'

const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env.HUGGINGFACE_API_KEY,
  model: 'BAAI/bge-base-en-v1.5',
})

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const material_id = formData.get('material_id') as string | null
  const session_id = formData.get('session_id') as string | null

  if (!file) {
    return Response.json({ error: 'file is required' }, { status: 400 })
  }
  if (!material_id) {
    return Response.json({ error: 'material_id is required' }, { status: 400 })
  }

  const filename = file.name
  const mime = file.type
  const buffer = Buffer.from(await file.arrayBuffer())

  // Parse text content
  let text: string
  try {
    if (mime === 'application/pdf' || filename.endsWith('.pdf')) {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      text = result.text
    } else {
      // Plain text / markdown
      text = buffer.toString('utf-8')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Parse failed'
    return Response.json({ error: `Failed to parse file: ${msg}` }, { status: 422 })
  }

  if (!text.trim()) {
    return Response.json({ error: 'No text content found in file' }, { status: 422 })
  }

  // Chunk the text
  const chunks = await chunkText(text)

  // Generate embeddings in batch
  const vectors = await embeddings.embedDocuments(chunks)

  // Insert into documents table
  const supabase = await createClient()
  const rows = chunks.map((content, i) => ({
    material_id,
    session_id: session_id ?? null,
    filename,
    chunk_index: i,
    content,
    embedding: vectors[i],
  }))

  const { error } = await supabase.from('documents').insert(rows)
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({
    filename,
    chunks: chunks.length,
    material_id,
  })
}
