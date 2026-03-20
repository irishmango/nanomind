'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat } from '@/context/ChatContext'

type DocEntry = {
  filename: string
  created_at: string
  chunk_count: number
}

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | { status: 'done'; filename: string; chunks: number }
  | { status: 'error'; message: string }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function DocumentsTab({ sessionId }: { sessionId: string | null }) {
  const { activeMaterials } = useChat()
  const activeMaterial = activeMaterials[0] ?? null
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!sessionId) { setDocs([]); return }
    setLoading(true)
    fetch(`/api/documents?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((d) => setDocs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [sessionId])

  async function upload(file: File) {
    if (!activeMaterial || !sessionId) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'txt', 'md'].includes(ext ?? '')) {
      setUploadState({ status: 'error', message: 'Only PDF, TXT, or MD files accepted.' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadState({ status: 'error', message: 'File too large — max 10 MB.' })
      return
    }

    setUploadState({ status: 'uploading', progress: 0 })

    const form = new FormData()
    form.append('file', file)
    form.append('material_id', activeMaterial.id)
    form.append('session_id', sessionId)

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/documents/upload')

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadState({ status: 'uploading', progress: Math.round((e.loaded / e.total) * 70) })
        }
      }

      xhr.onload = () => {
        setUploadState({ status: 'uploading', progress: 95 })
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadState({ status: 'done', filename: data.filename, chunks: data.chunks })
            setDocs((prev) => {
              const exists = prev.some((d) => d.filename === data.filename)
              if (exists) return prev
              return [{ filename: data.filename, created_at: new Date().toISOString(), chunk_count: data.chunks }, ...prev]
            })
          } else {
            setUploadState({ status: 'error', message: data.error ?? 'Upload failed' })
          }
        } catch {
          setUploadState({ status: 'error', message: 'Unexpected server response' })
        }
        resolve()
      }

      xhr.onerror = () => {
        setUploadState({ status: 'error', message: 'Network error — upload failed' })
        resolve()
      }

      xhr.send(form)
    })
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
    e.target.value = ''
  }

  async function deleteDoc(filename: string) {
    if (!sessionId) return
    setDeletingDoc(filename)
    await fetch(`/api/documents?session_id=${sessionId}&filename=${encodeURIComponent(filename)}`, { method: 'DELETE' })
    setDocs((prev) => prev.filter((d) => d.filename !== filename))
    setDeletingDoc(null)
  }

  if (!sessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="font-mono text-2xl text-white/10">↑</p>
        <p className="font-mono text-sm text-white/25">No session active</p>
        <p className="font-mono text-xs text-white/15">Start a conversation to upload documents.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
      {/* Upload zone */}
      <div>
        <p className="font-mono text-[10px] text-white/30 uppercase tracking-widest mb-2">Upload document</p>

        {!activeMaterial ? (
          <div className="rounded-lg border border-dashed border-white/[0.08] px-4 py-6 text-center">
            <p className="font-mono text-[10px] text-white/25">Select a material first to upload documents</p>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => uploadState.status !== 'uploading' && inputRef.current?.click()}
            className={`rounded-lg border border-dashed px-4 py-6 text-center transition-colors cursor-pointer
              ${dragging
                ? 'border-[#00D4AA]/60 bg-[#00D4AA]/[0.06]'
                : 'border-white/[0.12] hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.04]'
              }
              ${uploadState.status === 'uploading' ? 'pointer-events-none' : ''}`}
          >
            <input ref={inputRef} type="file" accept=".pdf,.txt,.md" onChange={onFileChange} className="hidden" />

            {uploadState.status === 'idle' && (
              <>
                <p className="font-mono text-[10px] text-white/30">Drop PDF, TXT, or MD</p>
                <p className="font-mono text-[9px] text-white/20 mt-0.5">or click to browse</p>
              </>
            )}

            {uploadState.status === 'uploading' && (
              <div className="space-y-2">
                <p className="font-mono text-[10px] text-[#00D4AA]/70">Embedding…</p>
                <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-[#00D4AA]/60 rounded-full transition-all duration-300"
                    style={{ width: `${uploadState.progress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadState.status === 'done' && (
              <div onClick={(e) => { e.stopPropagation(); setUploadState({ status: 'idle' }) }}>
                <p className="font-mono text-[10px] text-[#00D4AA]">✓ {uploadState.filename}</p>
                <p className="font-mono text-[9px] text-white/30 mt-0.5">{uploadState.chunks} chunk{uploadState.chunks !== 1 ? 's' : ''} indexed</p>
                <p className="font-mono text-[9px] text-white/20 mt-1">Click to upload another</p>
              </div>
            )}

            {uploadState.status === 'error' && (
              <div onClick={(e) => { e.stopPropagation(); setUploadState({ status: 'idle' }) }}>
                <p className="font-mono text-[10px] text-red-400/80">{uploadState.message}</p>
                <p className="font-mono text-[9px] text-white/20 mt-1">Click to retry</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Document list */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="font-mono text-[10px] text-white/30 uppercase tracking-widest">Session documents</p>
          <span className="font-mono text-[10px] text-white/20">{docs.length} file{docs.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <p className="font-mono text-xs text-white/25 px-1">No documents uploaded in this session.</p>
        ) : (
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left px-4 py-2.5 font-mono text-[10px] text-white/30 uppercase tracking-widest">Filename</th>
                  <th className="text-left px-4 py-2.5 font-mono text-[10px] text-white/30 uppercase tracking-widest w-16">Chunks</th>
                  <th className="text-left px-4 py-2.5 font-mono text-[10px] text-white/30 uppercase tracking-widest w-36 hidden md:table-cell">Uploaded</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.filename} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-white/70 truncate max-w-[220px]">{doc.filename}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/40">{doc.chunk_count}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-mono text-[10px] text-white/30">{formatDate(doc.created_at)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => deleteDoc(doc.filename)}
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
    </div>
  )
}
