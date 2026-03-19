import { createNanoAgent } from '@/lib/agent'
import { createClient } from '@/lib/supabase/server'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import type { AgentStep } from 'langchain/agents'

export async function POST(request: Request) {
  const { session_id, message, material_id } = await request.json()

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

        // Emit tool-use summary before the final answer
        const steps: AgentStep[] = result.intermediateSteps ?? []
        if (steps.length > 0) {
          send('**Tools used:**\n')
          for (const step of steps) {
            const toolName = step.action.tool
            const toolInput = JSON.stringify(step.action.toolInput)
            const toolOutput = typeof step.observation === 'string'
              ? step.observation.slice(0, 300) + (step.observation.length > 300 ? '…' : '')
              : String(step.observation)
            send(`\n- **${toolName}** \`${toolInput}\`\n  > ${toolOutput}\n`)
          }
          send('\n---\n\n')
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
