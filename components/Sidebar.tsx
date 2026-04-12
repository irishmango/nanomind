'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useChat } from '@/context/ChatContext'
import ConfirmModal from '@/components/ConfirmModal'

type Session = {
  id: string
  title: string | null
  created_at: string
}

function defaultSessionName() {
  const d = new Date()
  return `Session ${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`
}

const inputClass =
  'w-full bg-[#0A0C0F] border border-[#00D4AA]/40 rounded-md ' +
  'text-xs font-sans text-white/85 placeholder:text-white/25 ' +
  'px-2.5 py-1.5 outline-none focus:border-[#00D4AA]/70 transition-colors'

export default function Sidebar() {
  const { setSessionId, setMessages, sessionId, loadSession, isLoading, setActiveMaterials } =
    useChat()

  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionsOpen, setSessionsOpen] = useState(true)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<string | null>(null)

  // Inline new-session naming
  const [namingSession, setNamingSession] = useState(false)
  const [newName, setNewName] = useState('')
  const newNameRef = useRef<HTMLInputElement>(null)

  // Inline session renaming
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

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

  useEffect(() => {
    if (namingSession) newNameRef.current?.focus()
  }, [namingSession])

  async function handleNewSession(name: string) {
    const title = name.trim() || defaultSessionName()
    setNamingSession(false)
    setNewName('')
    setCreating(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, material_ids: [] }),
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
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error('[delete session] API error', res.status, body)
      setConfirmDeleteSession(null)
      return
    }
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (sessionId === id) {
      setSessionId(null)
      setMessages([])
      setActiveMaterials([])
    }
    setConfirmDeleteSession(null)
  }

  async function handleRename(id: string, title: string) {
    const name = title.trim()
    if (!name) { setRenamingId(null); return }
    await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: name }),
    })
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: name } : s)))
    setRenamingId(null)
  }

  return (
    <aside className="flex flex-col w-64 shrink-0 h-screen bg-[#0D1117] border-r border-white/[0.06]">
      {/* Header */}
      <div className="px-4 py-5 border-b border-white/[0.06]">
        <span className="font-mono text-[#00D4AA] text-sm font-semibold tracking-widest uppercase">
          NanoMind
        </span>
      </div>

      {/* New session — button or inline naming input */}
      <div className="px-3 pt-4 pb-2">
        {namingSession ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={newNameRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewSession(newName)
                if (e.key === 'Escape') { setNamingSession(false); setNewName('') }
              }}
              placeholder={defaultSessionName()}
              className={inputClass}
            />
            <button
              onClick={() => handleNewSession(newName)}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md
                bg-[#00D4AA]/15 hover:bg-[#00D4AA]/25 border border-[#00D4AA]/30
                text-[#00D4AA] text-sm transition-colors"
              aria-label="Confirm"
            >
              ✓
            </button>
          </div>
        ) : (
          <button
            onClick={() => setNamingSession(true)}
            disabled={creating || isLoading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md
              bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 border border-[#00D4AA]/30
              text-[#00D4AA] font-mono text-xs font-medium transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-base leading-none">+</span>
            {creating ? 'Creating…' : 'New session'}
          </button>
        )}
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
                const isRenaming = renamingId === s.id
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-1 rounded-md group transition-colors
                      ${isActive
                        ? 'bg-[#00D4AA]/10 border border-[#00D4AA]/30'
                        : 'border border-transparent hover:bg-white/[0.04]'
                      }`}
                  >
                    {isRenaming ? (
                      <div className="flex items-center gap-1.5 flex-1 px-1.5 py-1.5">
                        <input
                          ref={(el) => { if (el) el.focus() }}
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(s.id, renameValue)
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          className={inputClass}
                        />
                        <button
                          onClick={() => handleRename(s.id, renameValue)}
                          className="shrink-0 w-6 h-6 flex items-center justify-center rounded
                            bg-[#00D4AA]/15 hover:bg-[#00D4AA]/25 border border-[#00D4AA]/30
                            text-[#00D4AA] text-xs transition-colors"
                          aria-label="Confirm rename"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => loadSession(s.id)}
                          className="flex-1 min-w-0 text-left px-2.5 py-2"
                        >
                          <p className={`text-xs font-sans truncate leading-snug
                            ${isActive ? 'text-[#00D4AA]' : 'text-white/55 group-hover:text-white/75'}`}>
                            {s.title ?? 'Untitled session'}
                          </p>
                        </button>

                        {/* Rename (pencil) button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setRenamingId(s.id)
                            setRenameValue(s.title ?? '')
                          }}
                          className="shrink-0 w-5 h-5 flex items-center justify-center
                            rounded text-white/0 group-hover:text-white/30
                            hover:!text-white/60 hover:bg-white/[0.08] transition-colors
                            font-mono text-[10px]"
                          aria-label="Rename session"
                        >
                          ✏
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteSession(s.id) }}
                          className="shrink-0 mr-1.5 w-5 h-5 flex items-center justify-center
                            rounded text-white/0 group-hover:text-white/30
                            hover:!text-white/60 hover:bg-white/[0.08] transition-colors"
                          aria-label="Delete session"
                        >
                          ×
                        </button>
                      </>
                    )}
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
