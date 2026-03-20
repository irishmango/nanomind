'use client'

import { useRef, useState } from 'react'
import { useChat } from '@/context/ChatContext'
import { parseSpectra, extractPeaks, type SpectraData, type Peak, type SpectraType } from '@/lib/parseSpectra'
import SpectraChart from '@/components/SpectraChart'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const SPECTRA_TYPES: { value: SpectraType; label: string }[] = [
  { value: 'raman', label: 'Raman' },
  { value: 'ftir', label: 'FTIR' },
  { value: 'xrd', label: 'XRD' },
]

type Props = { fullWidth?: boolean }

export default function SpectraPanel({ fullWidth = false }: Props) {
  const { activeMaterials } = useChat()
  const activeMaterial = activeMaterials[0] ?? null
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [spectraType, setSpectraType] = useState<SpectraType>('raman')
  const [spectraData, setSpectraData] = useState<SpectraData | null>(null)
  const [peaks, setPeaks] = useState<Peak[]>([])
  const [annotatedPeaks, setAnnotatedPeaks] = useState<Peak[]>([])
  const [dragging, setDragging] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [annotation, setAnnotation] = useState<string>('')
  const [filename, setFilename] = useState<string | null>(null)

  function reset() {
    setSpectraData(null)
    setPeaks([])
    setAnnotatedPeaks([])
    setAnnotation('')
    setParseError(null)
    setFilename(null)
  }

  async function handleFile(file: File) {
    reset()
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xy', 'csv', 'txt'].includes(ext ?? '')) {
      setParseError('Only .xy, .csv, and .txt files are supported.')
      return
    }
    try {
      const text = await file.text()
      const data = parseSpectra(text, spectraType)
      const detected = extractPeaks(data)
      setSpectraData(data)
      setPeaks(detected)
      setFilename(file.name)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Failed to parse file.')
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function analyze() {
    if (!spectraData || !peaks.length) return
    setAnalysing(true)
    setAnnotation('')
    setAnnotatedPeaks([])

    try {
      const res = await fetch('/api/spectra/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peaks, spectraType, materialName: activeMaterial?.name }),
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setAnnotation(full)
      }

      const mentioned = [...full.matchAll(/\b(\d{2,4}(?:\.\d+)?)\s*cm[⁻-]?[¹1]?\b/g)]
        .map((m) => parseFloat(m[1]))
        .filter((x) => peaks.some((p) => Math.abs(p.x - x) < 5))

      setAnnotatedPeaks(
        [...new Set(mentioned)].slice(0, 12).map((x) => {
          const peak = peaks.find((p) => Math.abs(p.x - x) < 5)
          return { x, y: peak?.y ?? 0.5, label: x.toFixed(0) }
        }),
      )
    } catch (e) {
      setAnnotation(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setAnalysing(false)
    }
  }

  if (!activeMaterial) return null

  if (fullWidth) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-mono text-sm text-white/70 font-semibold">Spectra Viewer</h2>
            <p className="font-mono text-xs text-white/30 mt-0.5">{activeMaterial.name}</p>
          </div>
          <div className="flex gap-1.5">
            {SPECTRA_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => { setSpectraType(t.value); reset() }}
                className={`px-3 py-1.5 rounded-md font-mono text-xs transition-colors
                  ${spectraType === t.value
                    ? 'bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30'
                    : 'text-white/30 border border-white/[0.08] hover:text-white/50'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {!spectraData ? (
          /* Drop zone — full width */
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed py-16 text-center cursor-pointer transition-colors
              ${dragging
                ? 'border-[#00D4AA]/60 bg-[#00D4AA]/[0.04]'
                : 'border-white/[0.10] hover:border-white/20 bg-white/[0.02]'
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xy,.csv,.txt"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
            />
            <p className="font-mono text-2xl text-white/10 mb-3">◈</p>
            <p className="font-sans text-sm text-white/40 font-medium">Drop a spectrum file here</p>
            <p className="font-mono text-xs text-white/20 mt-1">.xy · .csv · .txt — two-column (x, intensity)</p>
            {parseError && (
              <p className="font-mono text-xs text-red-400/70 mt-3">{parseError}</p>
            )}
          </div>
        ) : (
          <>
            {/* File name + clear */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-white/40">{filename}</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-white/25">{peaks.length} peaks detected</span>
                <button onClick={reset} className="font-mono text-xs text-white/25 hover:text-white/60">
                  ✕ Clear
                </button>
              </div>
            </div>

            {/* Chart — tall in full-width mode */}
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4" style={{ height: 320 }}>
              <SpectraChart
                data={spectraData}
                spectraType={spectraType}
                annotatedPeaks={annotatedPeaks}
                height={280}
              />
            </div>

            {/* Analyze button */}
            <button
              onClick={analyze}
              disabled={analysing}
              className="w-full py-2.5 rounded-lg font-mono text-sm
                bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 border border-[#00D4AA]/30
                text-[#00D4AA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analysing ? 'Analysing…' : 'Analyze with AI'}
            </button>

            {/* Annotation */}
            {annotation && (
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] px-6 py-5">
                <p className="font-mono text-[10px] text-white/30 uppercase tracking-widest mb-3">
                  AI Annotation
                </p>
                <div className="prose prose-invert prose-sm max-w-none
                  prose-p:leading-relaxed prose-p:text-white/75
                  prose-headings:font-mono prose-headings:text-white/70
                  prose-strong:text-white/90
                  prose-code:text-[#00D4AA] prose-code:bg-transparent
                  prose-code:before:content-none prose-code:after:content-none
                  prose-table:font-mono prose-th:text-white/50 prose-td:text-white/65
                  prose-th:border-white/10 prose-td:border-white/[0.06]
                  prose-li:text-white/70">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{annotation}</ReactMarkdown>
                  {analysing && (
                    <span className="inline-block w-0.5 h-4 bg-[#00D4AA] ml-0.5 animate-pulse align-middle" />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // Compact sidebar version (kept for reference but no longer mounted)
  return null
}
