'use client'

import { useEffect, useState, useMemo } from 'react'

type Entry = {
  id: string
  technique: string
  finding: string
  confidence: 'high' | 'medium' | 'low'
  source: string
  created_at: string
  materials: { id: string; name: string; formula: string | null } | null
}

const CONFIDENCE_COLORS = {
  high: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  low: 'text-red-400 bg-red-400/10 border-red-400/30',
}

const TECHNIQUE_COLORS: Record<string, string> = {
  Raman: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  XRD: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  FTIR: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  AFM: 'text-pink-400 bg-pink-400/10 border-pink-400/30',
  TEM: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  SEM: 'text-teal-400 bg-teal-400/10 border-teal-400/30',
  XPS: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/30',
  synthesis: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  photocatalysis: 'text-lime-400 bg-lime-400/10 border-lime-400/30',
  general: 'text-white/40 bg-white/[0.04] border-white/10',
}

function Badge({ text, colorClass }: { text: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${colorClass}`}>
      {text}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function exportCSV(entries: Entry[]) {
  const header = ['Material', 'Technique', 'Finding', 'Confidence', 'Source', 'Date']
  const rows = entries.map((e) => [
    e.materials?.name ?? '',
    e.technique,
    `"${e.finding.replace(/"/g, '""')}"`,
    e.confidence,
    e.source,
    formatDate(e.created_at),
  ])
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nanomind-notebook-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function NotebookTab({ sessionId }: { sessionId: string | null }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [techniqueFilter, setTechniqueFilter] = useState('')
  const [confidenceFilter, setConfidenceFilter] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) { setEntries([]); return }
    setLoading(true)
    fetch(`/api/notebook?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((d) => setEntries(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [sessionId])

  const techniques = useMemo(() => [...new Set(entries.map((e) => e.technique))].sort(), [entries])

  const filtered = useMemo(() => entries.filter((e) => {
    if (techniqueFilter && e.technique !== techniqueFilter) return false
    if (confidenceFilter && e.confidence !== confidenceFilter) return false
    return true
  }), [entries, techniqueFilter, confidenceFilter])

  async function deleteEntry(id: string) {
    setDeletingId(id)
    await fetch(`/api/notebook?id=${id}`, { method: 'DELETE' })
    setEntries((prev) => prev.filter((e) => e.id !== id))
    setDeletingId(null)
  }

  if (!sessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="font-mono text-2xl text-white/10">◈</p>
        <p className="font-mono text-sm text-white/25">No session active</p>
        <p className="font-mono text-xs text-white/15">Start a conversation to see notebook entries.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="font-mono text-[10px] text-white/30 uppercase tracking-widest">Filter:</span>

        <select
          value={techniqueFilter}
          onChange={(e) => setTechniqueFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1.5
            font-mono text-xs text-white/60 focus:outline-none focus:border-[#00D4AA]/40"
        >
          <option value="">All techniques</option>
          {techniques.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={confidenceFilter}
          onChange={(e) => setConfidenceFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1.5
            font-mono text-xs text-white/60 focus:outline-none focus:border-[#00D4AA]/40"
        >
          <option value="">All confidence</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {(techniqueFilter || confidenceFilter) && (
          <button
            onClick={() => { setTechniqueFilter(''); setConfidenceFilter('') }}
            className="font-mono text-[11px] text-white/30 hover:text-white/60 transition-colors"
          >
            ✕ Clear
          </button>
        )}

        <span className="ml-auto font-mono text-[11px] text-white/25">
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
        </span>

        <button
          onClick={() => exportCSV(filtered)}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs
            border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20
            transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ↓ CSV
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="font-mono text-2xl text-white/10">◈</p>
          <p className="font-mono text-sm text-white/25">No entries for this session yet.</p>
          <p className="font-mono text-xs text-white/15">Entries are logged automatically after each chat response.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-white/30 uppercase tracking-widest w-24">Technique</th>
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-white/30 uppercase tracking-widest">Finding</th>
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-white/30 uppercase tracking-widest w-20">Confidence</th>
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-white/30 uppercase tracking-widest w-20 hidden sm:table-cell">Source</th>
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-white/30 uppercase tracking-widest w-36 hidden md:table-cell">Date</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors
                    ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                >
                  <td className="px-4 py-3">
                    <Badge text={entry.technique} colorClass={TECHNIQUE_COLORS[entry.technique] ?? TECHNIQUE_COLORS.general} />
                  </td>
                  <td className="px-4 py-3 font-sans text-xs text-white/75 leading-relaxed">{entry.finding}</td>
                  <td className="px-4 py-3">
                    <Badge text={entry.confidence} colorClass={CONFIDENCE_COLORS[entry.confidence] ?? CONFIDENCE_COLORS.medium} />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="font-mono text-[10px] text-white/35">{entry.source}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-mono text-[10px] text-white/30">{formatDate(entry.created_at)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      disabled={deletingId === entry.id}
                      className="text-white/15 hover:text-red-400/60 transition-colors font-mono text-xs disabled:opacity-40"
                      aria-label="Delete entry"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
