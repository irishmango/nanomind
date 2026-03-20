import { createNanoAgent } from '@/lib/agent'
import { createClient } from '@/lib/supabase/server'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import type { AgentStep } from 'langchain/agents'

export async function POST(request: Request) {
  const { session_id, message, material_ids } = await request.json()
  const material_id = Array.isArray(material_ids) ? (material_ids[0] ?? null) : null

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

  const encoder = new TextEncoder()
  let assistantContent = ''

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(text: string) {
        assistantContent += text
        controller.enqueue(encoder.encode(text))
      }

      try {
        const executor = createNanoAgent()
        const result = await executor.invoke({
          input: message,
          chat_history: chatHistory,
          material_id: material_id ?? null,
        })

        // Emit structured tool metadata as a parseable prefix (not accumulated into assistantContent)
        const steps: AgentStep[] = result.intermediateSteps ?? []
        if (steps.length > 0) {
          const toolMeta = steps.map((step) => {
            const inputObj = step.action.toolInput as Record<string, unknown>
            const input = String(Object.values(inputObj)[0] ?? '')
            const result = typeof step.observation === 'string'
              ? step.observation.slice(0, 150)
              : String(step.observation)
            return { tool: step.action.tool, input, result }
          })
          controller.enqueue(encoder.encode(`__TOOL__${JSON.stringify(toolMeta)}\n`))
        }

        send(result.output)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        send(`[agent error: ${msg}]`)
      }

      // Persist assistant response
      try {
        await supabase.from('messages').insert({
          session_id,
          role: 'assistant',
          content: assistantContent,
        })
      } catch { /* non-fatal */ }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
