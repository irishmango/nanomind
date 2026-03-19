'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Message } from '@/context/ChatContext'

const LS_KEY = 'nanomind_session_id'

export function useSession() {
  const [sessionId, setSessionIdState] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isHydrating, setIsHydrating] = useState(true)

  // On mount: restore last session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (!stored) {
      setIsHydrating(false)
      return
    }
    fetch(`/api/sessions/${stored}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.messages?.length) {
          setSessionIdState(stored)
          setMessages(
            data.messages.map((m: { id: string; role: 'user' | 'assistant'; content: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            })),
          )
        } else {
          localStorage.removeItem(LS_KEY)
        }
      })
      .catch(() => localStorage.removeItem(LS_KEY))
      .finally(() => setIsHydrating(false))
  }, [])

  const setSessionId = useCallback((id: string | null) => {
    setSessionIdState(id)
    if (id) localStorage.setItem(LS_KEY, id)
    else localStorage.removeItem(LS_KEY)
  }, [])

  const loadSession = useCallback(async (id: string) => {
    const res = await fetch(`/api/sessions/${id}`)
    if (!res.ok) return
    const data = await res.json()
    setSessionIdState(id)
    localStorage.setItem(LS_KEY, id)
    setMessages(
      (data.messages ?? []).map(
        (m: { id: string; role: 'user' | 'assistant'; content: string }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }),
      ),
    )
  }, [])

  return { sessionId, setSessionId, messages, setMessages, isHydrating, loadSession }
}
