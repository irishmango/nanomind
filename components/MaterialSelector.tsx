'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat, type Material } from '@/context/ChatContext'

export default function MaterialSelector() {
  const { activeMaterials, setActiveMaterials } = useChat()
  const [allMaterials, setAllMaterials] = useState<Material[]>([])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName] = useState('')
  const [addFormula, setAddFormula] = useState('')
  const [addTags, setAddTags] = useState<string[]>([])
  const [addTagInput, setAddTagInput] = useState('')
  const [adding, setAdding] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/materials')
      .then((r) => r.json())
      .then((d) => setAllMaterials(Array.isArray(d) ? d : []))
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowAddForm(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open && !showAddForm) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open, showAddForm])

  const filtered = allMaterials.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.formula ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  function toggle(material: Material) {
    const isSelected = activeMaterials.some((m) => m.id === material.id)
    if (isSelected) {
      setActiveMaterials(activeMaterials.filter((m) => m.id !== material.id))
    } else {
      setActiveMaterials([...activeMaterials, material])
    }
  }

  function deselect(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setActiveMaterials(activeMaterials.filter((m) => m.id !== id))
  }

  function looksLikeFormula(s: string) {
    return /^[A-Z][a-zA-Z0-9]*(\d|[A-Z])/.test(s.trim())
  }

  function handleAddNameChange(val: string) {
    setAddName(val)
    if (!addFormula && looksLikeFormula(val)) setAddFormula(val)
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = addTagInput.trim().replace(/,$/, '')
      if (tag && !addTags.includes(tag)) setAddTags((prev) => [...prev, tag])
      setAddTagInput('')
    } else if (e.key === 'Backspace' && !addTagInput) {
      setAddTags((prev) => prev.slice(0, -1))
    }
  }

  async function handleAddMaterial(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!addName.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName.trim(),
          formula: addFormula.trim() || undefined,
          tags: addTags,
        }),
      })
      if (res.ok) {
        const newMat: Material = await res.json()
        setAllMaterials((prev) => [...prev, newMat])
        setActiveMaterials([...activeMaterials, newMat])
        setAddName('')
        setAddFormula('')
        setAddTags([])
        setAddTagInput('')
        setShowAddForm(false)
      }
    } finally {
      setAdding(false)
    }
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5 flex-wrap min-w-0">
      {/* Selected material chips */}
      {activeMaterials.map((m) => (
        <span
          key={m.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md
            bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] font-mono text-[11px]"
        >
          {m.formula ?? m.name}
          <button
            onClick={(e) => deselect(m.id, e)}
            className="text-[#00D4AA]/50 hover:text-[#00D4AA] transition-colors leading-none ml-0.5"
            aria-label={`Remove ${m.name}`}
          >
            ×
          </button>
        </span>
      ))}

      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 font-mono text-[11px] transition-colors rounded px-1.5 py-0.5
          hover:bg-white/[0.04] ${activeMaterials.length > 0 ? 'text-white/35 hover:text-white/55' : 'text-white/25 hover:text-white/45'}`}
      >
        {activeMaterials.length === 0 ? 'Select material context' : '+ Add material'}
        <span className="text-[9px] opacity-50">▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 mt-2 w-72 z-50 rounded-xl border border-white/[0.10]
            bg-[#0D1117] shadow-2xl overflow-hidden"
        >
          {!showAddForm ? (
            <>
              {/* Search input */}
              <div className="px-3 pt-3 pb-2 border-b border-white/[0.06]">
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search materials…"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md
                    px-2.5 py-1.5 font-mono text-xs text-white/70 placeholder:text-white/25
                    focus:outline-none focus:border-[#00D4AA]/40"
                />
              </div>

              {/* Material list */}
              <div className="max-h-56 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <p className="px-3 py-3 font-mono text-[11px] text-white/25">No results</p>
                ) : (
                  filtered.map((m) => {
                    const selected = activeMaterials.some((a) => a.id === m.id)
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggle(m)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors
                          hover:bg-white/[0.04] ${selected ? 'bg-[#00D4AA]/[0.05]' : ''}`}
                      >
                        <span
                          className={`w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center
                            ${selected
                              ? 'bg-[#00D4AA]/20 border-[#00D4AA]/50 text-[#00D4AA]'
                              : 'border-white/[0.18]'
                            }`}
                        >
                          {selected && <span className="text-[8px] leading-none">✓</span>}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span
                            className={`block text-xs font-sans truncate
                              ${selected ? 'text-[#00D4AA]' : 'text-white/70'}`}
                          >
                            {m.name}
                          </span>
                          {m.formula && (
                            <span className="block font-mono text-[10px] text-white/30 truncate">
                              {m.formula}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>

              {/* Add new material */}
              <div className="border-t border-white/[0.06] px-3 py-2.5">
                <button
                  onClick={() => { setShowAddForm(true); setSearch('') }}
                  className="w-full text-left font-mono text-[11px] text-white/30
                    hover:text-white/55 transition-colors"
                >
                  + New material
                </button>
              </div>
            </>
          ) : (
            /* Inline add-material form */
            <form onSubmit={handleAddMaterial} className="p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="font-mono text-[10px] text-white/40 uppercase tracking-widest">
                  New material
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="font-mono text-[11px] text-white/25 hover:text-white/50 transition-colors"
                >
                  ← Back
                </button>
              </div>

              <input
                autoFocus
                placeholder="Name"
                value={addName}
                onChange={(e) => handleAddNameChange(e.target.value)}
                className="w-full bg-transparent border border-white/[0.10] rounded px-2 py-1.5
                  text-xs text-white/80 placeholder:text-white/25 font-mono
                  focus:outline-none focus:border-[#00D4AA]/50"
              />
              <input
                placeholder="Formula (optional)"
                value={addFormula}
                onChange={(e) => setAddFormula(e.target.value)}
                className="w-full bg-transparent border border-white/[0.10] rounded px-2 py-1.5
                  text-xs text-white/80 placeholder:text-white/25 font-mono
                  focus:outline-none focus:border-[#00D4AA]/50"
              />
              <div className="flex flex-wrap gap-1 p-1.5 rounded border border-white/[0.10] min-h-[30px]">
                {addTags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.08] text-white/50"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setAddTags((prev) => prev.filter((t) => t !== tag))}
                      className="text-white/30 hover:text-white/60"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  placeholder={addTags.length === 0 ? 'Tags (separate by commas)' : ''}
                  value={addTagInput}
                  onChange={(e) => setAddTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  className="flex-1 min-w-[80px] bg-transparent text-xs text-white/80
                    placeholder:text-white/25 font-mono focus:outline-none"
                />
              </div>

              <div className="flex gap-1.5 pt-1">
                <button
                  type="submit"
                  disabled={adding || !addName.trim()}
                  className="flex-1 py-1.5 rounded text-[10px] font-mono font-medium
                    bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 border border-[#00D4AA]/30
                    text-[#00D4AA] transition-colors disabled:opacity-40"
                >
                  {adding ? 'Adding…' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded text-[10px] font-mono text-white/40
                    hover:text-white/60 hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
