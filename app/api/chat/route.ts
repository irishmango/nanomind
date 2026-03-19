import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NANOSCIENCE_SYSTEM_PROMPT } from '@/lib/prompts/nanoscience'
import { retrieveContext } from '@/lib/retriever'
import type { SupabaseClient } from '@supabase/supabase-js'

type NotebookEntry = {
  technique: string
  finding: string
  confidence: 'high' | 'medium' | 'low'
  source: 'AI' | 'literature' | 'experimental'
}

async function extractAndLogFinding({
  assistantContent,
  sessionId,
  materialId,
  anthropic,
  supabase,
}: {
  assistantContent: string
  sessionId: string
  materialId: string | null
  anthropic: Anthropic
  supabase: SupabaseClient
}) {
  // Skip short or error responses
  if (assistantContent.length < 80 || assistantContent.startsWith('[error')) return

  const extraction = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: `Extract the key scientific finding from the following response as JSON.
Return ONLY valid JSON matching this schema exactly, no other text:
{"technique":"XRD|Raman|FTIR|AFM|TEM|SEM|XPS|synthesis|photocatalysis|general","finding":"one concise sentence","confidence":"high|medium|low","source":"AI|literature|experimental"}

Response:
${assistantContent.slice(0, 1500)}`,
      },
    ],
  })

  const raw = extraction.content[0]?.type === 'text' ? extraction.content[0].text.trim() : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return

  const entry: NotebookEntry = JSON.parse(jsonMatch[0])
  if (!entry.finding || entry.finding.length < 10) return

  await supabase.from('notebook_entries').insert({
    session_id: sessionId,
    material_id: materialId,
    technique: entry.technique ?? 'general',
    finding: entry.finding,
    confidence: entry.confidence ?? 'medium',
    source: entry.source ?? 'AI',
  })
}

// When true: model must answer ONLY from retrieved context, no outside knowledge
const STRICT_RAG = true

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const { session_id, message, material_id } = await request.json()

  if (!session_id || !message) {
    return Response.json({ error: 'session_id and message are required' }, { status: 400 })
  }

  const supabase = await createClient()

  // 1. Persist the user message
  const { error: insertError } = await supabase.from('messages').insert({
    session_id,
    role: 'user',
    content: message,
  })

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 })
  }

  // 2. Fetch last 10 messages as conversation history
  const { data: history, error: historyError } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: false })
    .limit(10)

  if (historyError) {
    return Response.json({ error: historyError.message }, { status: 500 })
  }

  const conversationHistory = (history ?? [])
    .reverse()
    .map(({ role, content }) => ({
      role: role as 'user' | 'assistant',
      content,
    }))

  // 3. Fetch material metadata
  let materialContext = ''
  if (material_id) {
    const { data: material } = await supabase
      .from('materials')
      .select('name, formula, description, tags')
      .eq('id', material_id)
      .single()

    if (material) {
      materialContext =
        `\n\nActive material context:\n` +
        `Name: ${material.name}\n` +
        `Formula: ${material.formula ?? 'N/A'}\n` +
        `Description: ${material.description ?? 'N/A'}\n` +
        `Tags: ${(material.tags ?? []).join(', ')}`
    }
  }

  // 4. Retrieve RAG context
  let ragContext = ''
  if (material_id) {
    try {
      ragContext = await retrieveContext(message, material_id)
    } catch (e) {
      console.error('RAG retrieval error:', e)
    }
  }

  // 5. Build system prompt
  let systemPrompt = NANOSCIENCE_SYSTEM_PROMPT + materialContext

  if (ragContext) {
    systemPrompt += `

RELEVANT LITERATURE CONTEXT:
${ragContext}

STRICT INSTRUCTIONS FOR USING THIS CONTEXT:
- This context is your PRIMARY source. Use it before any other knowledge.
- Do NOT invent numerical values, tables, or figures not present in the context.
- When you use information from the context, cite the chunk filename (e.g. "According to paper.pdf, …").
- If the answer cannot be found in the context${STRICT_RAG ? '' : ' or your general knowledge'}, respond: "This information was not found in the uploaded document."
${STRICT_RAG ? '- You must ONLY use the retrieved context above to answer. Do not draw on outside knowledge for factual claims about this material or experiment.' : ''}`
  } else if (STRICT_RAG && material_id) {
    systemPrompt += `

No document context was retrieved for this query. Inform the user that no relevant sections were found in the uploaded document, and offer to answer from general knowledge if they wish.`
  }

  // 6. Stream response from Anthropic
  const encoder = new TextEncoder()
  let assistantContent = ''

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: conversationHistory,
          temperature: 0.1,
        })

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const text = event.delta.text
            assistantContent += text
            controller.enqueue(encoder.encode(text))
          }
        }

        // Persist the assistant message after stream completes
        await supabase.from('messages').insert({
          session_id,
          role: 'assistant',
          content: assistantContent,
        })

        // Auto-log to notebook (fire-and-forget — non-blocking)
        extractAndLogFinding({
          assistantContent,
          sessionId: session_id,
          materialId: material_id ?? null,
          anthropic,
          supabase,
        }).catch(() => { /* non-fatal */ })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(encoder.encode(`[error: ${msg}]`))
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
