'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useChat } from '@/context/ChatContext'

type Document = {
  filename: string
  created_at: string
  chunk_count: number
}

type Entry = {
  id: string
  technique: string
  finding: string
  confidence: 'high' | 'medium' | 'low'
  source: string
  created_at: string
  materials: { id: string; name: string; formula: string | null } | null
  sessions: { id: string; title: string | null } | null
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
  const header = ['ID', 'Material', 'Formula', 'Technique', 'Finding', 'Confidence', 'Source', 'Date']
  const rows = entries.map((e) => [
    e.id,
    e.materials?.name ?? '',
    e.materials?.formula ?? '',
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

export default function NotebookPage() {
  const { sessionId } = useChat()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [techniqueFilter, setTechniqueFilter] = useState('')
  const [confidenceFilter, setConfidenceFilter] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [documents, setDocuments] = useState<Document[]>([])
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/notebook')
      .then((r) => r.json())
      .then((d) => setEntries(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!sessionId) { setDocuments([]); return }
    fetch(`/api/documents?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((d) => setDocuments(Array.isArray(d) ? d : []))
  }, [sessionId])

  async function deleteDocument(filename: string) {
    if (!sessionId) return
    setDeletingDoc(filename)
    await fetch(`/api/documents?session_id=${sessionId}&filename=${encodeURIComponent(filename)}`, { method: 'DELETE' })
    setDocuments((prev) => prev.filter((d) => d.filename !== filename))
    setDeletingDoc(null)
  }

  const techniques = useMemo(
    () => [...new Set(entries.map((e) => e.technique))].sort(),
    [entries],
  )

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (techniqueFilter && e.technique !== techniqueFilter) return false
      if (confidenceFilter && e.confidence !== confidenceFilter) return false
      return true
    })
  }, [entries, techniqueFilter, confidenceFilter])

  // Group by material
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; entries: Entry[] }>()
    for (const e of filtered) {
      const key = e.materials?.id ?? 'unknown'
      const label = e.materials?.name ?? 'Unknown material'
      if (!map.has(key)) map.set(key, { label, entries: [] })
      map.get(key)!.entries.push(e)
    }
    return [...map.entries()]
  }, [filtered])

  async function deleteEntry(id: string) {
    setDeletingId(id)
    await fetch(`/api/notebook?id=${id}`, { method: 'DELETE' })
    setEntries((prev) => prev.filter((e) => e.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="min-h-screen bg-[#0A0C0F] text-white/85">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-mono text-[#00D4AA] text-sm font-semibold tracking-widest uppercase hover:opacity-80 transition-opacity"
          >
            NanoMind
          </Link>
          <span className="text-white/20">/</span>
          <span className="font-mono text-xs text-white/50">Experiment Notebook</span>
        </div>
        <button
          onClick={() => exportCSV(filtered)}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs
            border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20
            transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ↓ Export CSV
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
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
        </div>

        {/* Documents */}
        {sessionId && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="font-sans text-sm font-semibold text-white/70">Uploaded documents</h2>
              <span className="font-mono text-[10px] text-white/25">{documents.length} file{documents.length !== 1 ? 's' : ''}</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            {documents.length === 0 ? (
              <p className="font-mono text-xs text-white/25 px-1">No documents uploaded in this session.</p>
            ) : (
              <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                      <th className="text-left px-4 py-2.5 font-mono text-[10px] text-white/30 uppercase tracking-widest">Filename</th>
                      <th className="text-left px-4 py-2.5 font-mono text-[10px] text-white/30 uppercase tracking-widest w-20">Chunks</th>
                      <th className="text-left px-4 py-2.5 font-mono text-[10px] text-white/30 uppercase tracking-widest w-36 hidden md:table-cell">Uploaded</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.filename} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-white/70 truncate max-w-[200px]">{doc.filename}</td>
                        <td className="px-4 py-3 font-mono text-xs text-white/40">{doc.chunk_count}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="font-mono text-[10px] text-white/30">{formatDate(doc.created_at)}</span>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => deleteDocument(doc.filename)}
                            disabled={deletingDoc === doc.filename}
                            className="text-white/15 hover:text-red-400/60 transition-colors font-mono text-xs disabled:opacity-40"
                            aria-label="Delete document"
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
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-mono text-3xl text-white/10 mb-4">◈</p>
            <p className="font-mono text-sm text-white/25">No notebook entries yet.</p>
            <p className="font-mono text-xs text-white/15 mt-2">
              Entries are logged automatically after each chat response.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(([materialId, { label, entries: matEntries }]) => (
              <section key={materialId}>
                {/* Material group header */}
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="font-sans text-sm font-semibold text-white/70">{label}</h2>
                  <span className="font-mono text-[10px] text-white/25">{matEntries.length} entries</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                {/* Table */}
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
                      {matEntries.map((entry, i) => (
                        <tr
                          key={entry.id}
                          className={`border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors
                            ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                        >
                          <td className="px-4 py-3">
                            <Badge
                              text={entry.technique}
                              colorClass={TECHNIQUE_COLORS[entry.technique] ?? TECHNIQUE_COLORS.general}
                            />
                          </td>
                          <td className="px-4 py-3 font-sans text-xs text-white/75 leading-relaxed">
                            {entry.finding}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              text={entry.confidence}
                              colorClass={CONFIDENCE_COLORS[entry.confidence] ?? CONFIDENCE_COLORS.medium}
                            />
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="font-mono text-[10px] text-white/35">{entry.source}</span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="font-mono text-[10px] text-white/30">
                              {formatDate(entry.created_at)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              disabled={deletingId === entry.id}
                              className="text-white/15 hover:text-red-400/60 transition-colors font-mono text-xs
                                disabled:opacity-40"
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
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
