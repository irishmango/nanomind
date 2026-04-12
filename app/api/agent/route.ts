import { createNanoAgent } from '@/lib/agent'
import { createClient } from '@/lib/supabase/server'
import { retrieveContext } from '@/lib/retriever'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import type { AgentStep } from 'langchain/agents'
import type { ClarifyOption } from '@/context/ChatContext'

export async function POST(request: Request) {
  const { session_id, message, spectra_context } = await request.json()

  if (!session_id || !message) {
    return Response.json({ error: 'session_id and message are required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Persist user message
  const { error: insertError } = await supabase.from('messages').insert({
    session_id,
    role: 'user',
    content: message,
  })
  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 })
  }

  // Fetch conversation history (last 10)
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: false })
    .limit(10)

  const chatHistory = (history ?? [])
    .reverse()
    .slice(0, -1) // exclude the message we just inserted
    .map(({ role, content }) =>
      role === 'user' ? new HumanMessage(content) : new AIMessage(content),
    )

  try {
    // Retrieve RAG context first so the agent sees uploaded documents
    // before deciding whether to call a tool
    let augmentedInput = message
    let ragFilenames: string[] = []

    // Prepend uploaded spectrum peaks if present
    if (spectra_context?.peaks?.length) {
      const TYPE_LABELS: Record<string, string> = { raman: 'Raman', ftir: 'FTIR', xrd: 'XRD (X-ray diffraction)' }
      const label = TYPE_LABELS[spectra_context.spectraType] ?? spectra_context.spectraType
      const peakList = (spectra_context.peaks as Array<{ x: number; y: number }>)
        .map((p: { x: number; y: number }, i: number) => `${i + 1}. x = ${p.x.toFixed(1)}, normalised intensity = ${p.y.toFixed(3)}`)
        .join('\n')
      augmentedInput = `UPLOADED SPECTRUM — ${label}${spectra_context.filename ? ` (${spectra_context.filename})` : ''}:\n${peakList}\n\nQUESTION: ${message}`
    }

    try {
      const ragContext = await retrieveContext(message, '', session_id)
      if (ragContext) {
        augmentedInput = `DOCUMENT CONTEXT:\n${ragContext}\n\n${augmentedInput}`
        // Extract filenames from chunk headers "Chunk N — filename.pdf"
        const matches = ragContext.matchAll(/— ([\w\-. ]+\.(pdf|txt|md))/gi)
        ragFilenames = [...new Set([...matches].map((m) => m[1]))]
      }
    } catch { /* non-fatal — proceed without RAG context */ }

    const executor = createNanoAgent()
    const result = await executor.invoke({
      input: augmentedInput,
      chat_history: chatHistory,
    })

    // result.output may be a plain string or an array of Anthropic content blocks
    // e.g. [{ type: 'text', text: '...' }, ...]
    function extractText(output: unknown): string {
      if (typeof output === 'string') return output
      if (Array.isArray(output)) {
        return output
          .filter((b) => b && (b as Record<string, unknown>).type === 'text')
          .map((b) => String((b as Record<string, unknown>).text ?? ''))
          .join('')
      }
      if (output != null && typeof output === 'object') {
        const o = output as Record<string, unknown>
        if (typeof o.text === 'string') return o.text
        if (typeof o.content === 'string') return o.content
      }
      return ''
    }

    let answer = extractText(typeof result === 'string' ? result : result.output ?? result.text ?? '')

    // Extract __CLARIFY__ prefix if the LLM emitted one
    let clarifyOptions: ClarifyOption[] | undefined
    if (answer.startsWith('__CLARIFY__')) {
      const newlineIdx = answer.indexOf('\n')
      if (newlineIdx !== -1) {
        try {
          clarifyOptions = JSON.parse(answer.slice('__CLARIFY__'.length, newlineIdx)) as ClarifyOption[]
          answer = answer.slice(newlineIdx + 1)
        } catch { /* malformed — leave answer as-is */ }
      }
    }

    // Build tool calls metadata
    const steps: AgentStep[] = result.intermediateSteps ?? []
    const toolCalls = steps.map((step) => {
      const inputObj = step.action.toolInput as Record<string, unknown>
      const input = String(Object.values(inputObj)[0] ?? '')
      const obs = typeof step.observation === 'string'
        ? step.observation.slice(0, 150)
        : String(step.observation)
      return { tool: step.action.tool, input, result: obs }
    })

    // Determine sources
    const sources: string[] = []
    const usedMP = steps.some(
      (s) => s.action.tool === 'get_structure' || s.action.tool === 'get_properties',
    )
    if (usedMP) sources.push('Materials Project')
    if (ragFilenames.length > 0) sources.push(...ragFilenames)
    if (sources.length === 0) sources.push('AI knowledge')

    // Persist assistant response
    try {
      await supabase.from('messages').insert({
        session_id,
        role: 'assistant',
        content: answer,
      })
    } catch { /* non-fatal */ }

    return Response.json({ answer, sources, toolCalls, clarifyOptions })
  } catch (err) {
    console.error('[agent] invoke error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ answer: `[agent error: ${msg}]`, sources: [], toolCalls: [] })
  }
}
