import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf'
import { createClient } from '@/lib/supabase/server'

const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env.HUGGINGFACE_API_KEY,
  model: 'BAAI/bge-base-en-v1.5',
})

// Augment the raw query to boost recall for methods/instrumentation sections
function buildEnhancedQuery(query: string): string {
  return `${query}

Focus especially on:
- experimental methods and procedures
- measurement and characterisation techniques
- how specific properties (e.g. thickness, bandgap, morphology) were determined
- instrumentation used (AFM, TEM, SEM, Raman, XRD, XPS, etc.)
- sample preparation and synthesis conditions`
}

export async function retrieveContext(
  query: string,
  _materialId: string,
  sessionId: string | null = null,
  k = 8,
): Promise<string> {
  const enhancedQuery = buildEnhancedQuery(query)

  // 1. Embed the augmented query
  const [queryEmbedding] = await embeddings.embedDocuments([enhancedQuery])

  // 2. Call match_documents RPC with higher recall settings
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.3,
    match_count: k,
    match_session_id: sessionId ?? null,
  })

  if (error) throw new Error(`Retrieval failed: ${error.message}`)

  console.log(
    'RAG CONTEXT:',
    (data ?? []).map((c: { similarity: number; filename: string }) =>
      `[${c.similarity.toFixed(3)}] ${c.filename}`,
    ),
  )

  if (!data || data.length === 0) return ''

  // 3. Format top-k chunks
  return (data as { content: string; filename: string; similarity: number }[])
    .map(
      (chunk, i) =>
        `[Chunk ${i + 1}${chunk.filename ? ` — ${chunk.filename}` : ''} (similarity: ${chunk.similarity.toFixed(3)})]:\n${chunk.content}`,
    )
    .join('\n\n---\n\n')
}
