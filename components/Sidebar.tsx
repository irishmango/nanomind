'use client'

import { useEffect, useState, useCallback } from 'react'
import { useChat } from '@/context/ChatContext'
import ConfirmModal from '@/components/ConfirmModal'

type Session = {
  id: string
  title: string | null
  created_at: string
}

export default function Sidebar() {
  const {
    setSessionId,
    setMessages,
    sessionId,
    loadSession,
    isLoading,
    setActiveMaterials,
  } = useChat()

  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionsOpen, setSessionsOpen] = useState(true)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<string | null>(null)

  const fetchSessions = useCallback(() => {
    setSessionsLoading(true)
    fetch('/api/sessions')
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .finally(() => setSessionsLoading(false))
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions, sessionId])

  async function handleNewSession() {
    setCreating(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New session', material_ids: [] }),
      })
      const { id } = await res.json()
      setSessionId(id as string)
      setMessages([])
      setActiveMaterials([])
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteSession(id: string) {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (sessionId === id) {
      setSessionId(null)
      setMessages([])
      setActiveMaterials([])
    }
    setConfirmDeleteSession(null)
  }

  return (
    <aside className="flex flex-col w-64 shrink-0 h-screen bg-[#0D1117] border-r border-white/[0.06]">
      {/* Header */}
      <div className="px-4 py-5 border-b border-white/[0.06]">
        <span className="font-mono text-[#00D4AA] text-sm font-semibold tracking-widest uppercase">
          NanoMind
        </span>
      </div>

      {/* New session button */}
      <div className="px-3 pt-4 pb-2">
        <button
          onClick={handleNewSession}
          disabled={creating || isLoading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md
            bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 border border-[#00D4AA]/30
            text-[#00D4AA] font-mono text-xs font-medium transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-base leading-none">+</span>
          {creating ? 'Creating…' : 'New session'}
        </button>
      </div>

      {/* Recent sessions */}
      <div className="flex-1 overflow-y-auto px-3 pt-3">
        <button
          onClick={() => setSessionsOpen((o) => !o)}
          className="flex items-center justify-between w-full px-1 mb-1 group"
        >
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
            Recent sessions
          </p>
          <span className={`text-white/20 text-xs transition-transform ${sessionsOpen ? '' : '-rotate-90'}`}>
            ▾
          </span>
        </button>

        {sessionsOpen && (
          <div className="space-y-0.5 pb-4">
            {sessionsLoading ? (
              <div className="space-y-1.5 pt-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-9 rounded-md bg-white/[0.04] animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-white/25 font-mono px-1 py-1">No sessions yet.</p>
            ) : (
              sessions.map((s) => {
                const isActive = sessionId === s.id
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-1 rounded-md group transition-colors
                      ${isActive
                        ? 'bg-[#00D4AA]/10 border border-[#00D4AA]/30'
                        : 'border border-transparent hover:bg-white/[0.04]'
                      }`}
                  >
                    <button
                      onClick={() => loadSession(s.id)}
                      className="flex-1 min-w-0 text-left px-2.5 py-2"
                    >
                      <p className={`text-xs font-sans truncate leading-snug
                        ${isActive ? 'text-[#00D4AA]' : 'text-white/55 group-hover:text-white/75'}`}>
                        {s.title ?? 'Untitled session'}
                      </p>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteSession(s.id) }}
                      className="shrink-0 mr-1.5 w-5 h-5 flex items-center justify-center
                        rounded text-white/0 group-hover:text-white/30
                        hover:!text-white/60 hover:bg-white/[0.08] transition-colors"
                      aria-label="Delete session"
                    >
                      ×
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Model badge */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
          <span className="font-mono text-[10px] text-white/40 tracking-wide">
            claude-sonnet-4-6
          </span>
        </div>
      </div>

      {confirmDeleteSession && (
        <ConfirmModal
          message="Delete this session? All messages will be permanently removed."
          onConfirm={() => handleDeleteSession(confirmDeleteSession)}
          onCancel={() => setConfirmDeleteSession(null)}
        />
      )}
    </aside>
  )
}
