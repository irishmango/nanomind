'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { useSession } from '@/hooks/useSession'
import type { Peak, SpectraType } from '@/lib/parseSpectra'

export type Material = {
  id: string
  name: string
  formula: string | null
  description: string | null
  tags: string[] | null
  created_at: string
}

export type SpectraContext = {
  peaks: Peak[]
  spectraType: SpectraType
  filename: string | null
}

export type ToolCall = {
  tool: string
  input: string
  result: string
}

export type ClarifyOption = {
  label: string
  value: string
}

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  isAgent?: boolean
  toolCalls?: ToolCall[]
  clarifyOptions?: ClarifyOption[]
  source?: string   // non-agent: single derived source string
  sources?: string[] // agent: array of explicit sources
}

type ChatContextValue = {
  activeMaterials: Material[]
  setActiveMaterials: (m: Material[]) => void
  spectraContext: SpectraContext | null
  setSpectraContext: (ctx: SpectraContext | null) => void
  sessionId: string | null
  setSessionId: (id: string | null) => void
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  isLoading: boolean
  isHydrating: boolean
  agentMode: boolean
  setAgentMode: (v: boolean) => void
  loadSession: (id: string) => Promise<void>
  sendMessage: (text: string) => Promise<void>
  stopGeneration: () => void
  retryLast: () => Promise<void>
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [activeMaterials, setActiveMaterials] = useState<Material[]>([])
  const [spectraContext, setSpectraContext] = useState<SpectraContext | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [agentMode, setAgentMode] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsLoading(false)
  }, [])

  const { sessionId, setSessionId, messages, setMessages, isHydrating, loadSession } =
    useSession()

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return

      abortControllerRef.current = new AbortController()
      const { signal } = abortControllerRef.current

      // Ensure a session exists
      let sid = sessionId
      if (!sid) {
        const title =
          activeMaterials.length > 0
            ? `${activeMaterials.map((m) => m.formula ?? m.name).join(', ')} session`
            : 'New session'
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            material_ids: activeMaterials.map((m) => m.id),
          }),
        })
        const data = await res.json()
        sid = data.id as string
        setSessionId(sid)
      }

      // Optimistically add the user message
      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)

      // Add a streaming placeholder for the assistant
      const assistantId = crypto.randomUUID()
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', streaming: true, isAgent: agentMode },
      ])

      try {
        const body = JSON.stringify({
          session_id: sid,
          message: text,
          material_ids: activeMaterials.map((m) => m.id),
          materials: activeMaterials,
          spectra_context: spectraContext,
        })

        if (agentMode) {
          // Agent mode: single JSON response (LangChain runs tools server-side)
          const res = await fetch('/api/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body,
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json() as {
            answer: string
            sources: string[]
            toolCalls: ToolCall[]
            clarifyOptions?: ClarifyOption[]
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: data.answer ?? '',
                    streaming: false,
                    toolCalls: data.toolCalls?.length ? data.toolCalls : undefined,
                    clarifyOptions: data.clarifyOptions,
                    sources: data.sources,
                  }
                : m,
            ),
          )
        } else {
          // Chat mode: streaming plain-text response
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body,
          })
          if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let streamedContent = ''

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              const chunk = decoder.decode(value, { stream: true })
              streamedContent += chunk
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
              )
            }
          } catch (e) {
            if ((e as Error).name !== 'AbortError') throw e
            // Aborted — keep partial text, fall through to set streaming: false
          }

          // Derive source badge from streamed content
          let source = 'AI knowledge'
          const fileMatch = streamedContent.match(/\b([\w\-.]+\.(pdf|txt|md))\b/i)
          if (fileMatch) source = `via ${fileMatch[1]}`

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, streaming: false, source } : m,
            ),
          )
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          // User stopped generation — keep partial content, clear streaming flag
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
          )
        } else {
          const errText = err instanceof Error ? err.message : 'Unknown error'
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: `Error: ${errText}`, streaming: false } : m,
            ),
          )
        }
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, sessionId, activeMaterials, spectraContext, agentMode, setSessionId, setMessages],
  )

  const retryLast = useCallback(async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser) return
    setMessages((prev) => {
      const idx = prev.findLastIndex((m) => m.role === 'assistant')
      return idx === -1 ? prev : prev.filter((_, i) => i !== idx)
    })
    await sendMessage(lastUser.content)
  }, [messages, setMessages, sendMessage])

  return (
    <ChatContext.Provider
      value={{
        activeMaterials,
        setActiveMaterials,
        spectraContext,
        setSpectraContext,
        sessionId,
        setSessionId,
        messages,
        setMessages,
        isLoading,
        isHydrating,
        agentMode,
        setAgentMode,
        loadSession,
        sendMessage,
        stopGeneration,
        retryLast,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used inside ChatProvider')
  return ctx
}
