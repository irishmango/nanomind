'use client'

import { useRef, useState } from 'react'
import { useChat } from '@/context/ChatContext'

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | { status: 'done'; filename: string; chunks: number }
  | { status: 'error'; message: string }

export default function UploadPanel() {
  const { activeMaterials, sessionId } = useChat()
  const activeMaterial = activeMaterials[0] ?? null
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    if (!activeMaterial) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'txt', 'md'].includes(ext ?? '')) {
      setState({ status: 'error', message: 'Only PDF, TXT, or MD files accepted.' })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setState({ status: 'error', message: 'File too large — max 10 MB.' })
      return
    }

    setState({ status: 'uploading', progress: 0 })

    const form = new FormData()
    form.append('file', file)
    form.append('material_id', activeMaterial.id)
    if (sessionId) form.append('session_id', sessionId)

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/documents/upload')

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          // Upload phase covers 0–70%; server processing fills 70–95% via a small pulse
          setState({ status: 'uploading', progress: Math.round((e.loaded / e.total) * 70) })
        }
      }

      xhr.onload = () => {
        setState({ status: 'uploading', progress: 95 })
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300) {
            setState({ status: 'done', filename: data.filename, chunks: data.chunks })
          } else {
            setState({ status: 'error', message: data.error ?? 'Upload failed' })
          }
        } catch {
          setState({ status: 'error', message: 'Unexpected server response' })
        }
        resolve()
      }

      xhr.onerror = () => {
        setState({ status: 'error', message: 'Network error — upload failed' })
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

  if (!activeMaterial) return null

  return (
    <div className="px-3 pb-4">
      <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest px-1 mb-1">
        Upload document
      </p>

      {!sessionId ? (
        <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-4 text-center">
          <p className="font-mono text-[10px] text-white/25 leading-relaxed">
            Start a conversation first<br />to upload documents
          </p>
        </div>
      ) : (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => state.status !== 'uploading' && inputRef.current?.click()}
        className={`relative rounded-lg border border-dashed px-3 py-4 text-center transition-colors cursor-pointer
          ${dragging
            ? 'border-[#00D4AA]/60 bg-[#00D4AA]/[0.06]'
            : 'border-white/[0.12] hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.04]'
          }
          ${state.status === 'uploading' ? 'pointer-events-none' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md"
          onChange={onFileChange}
          className="hidden"
        />

        {state.status === 'idle' && (
          <>
            <p className="font-mono text-[10px] text-white/30">Drop PDF or TXT</p>
            <p className="font-mono text-[9px] text-white/20 mt-0.5">or click to browse</p>
          </>
        )}

        {state.status === 'uploading' && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] text-[#00D4AA]/70">Embedding…</p>
            <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full bg-[#00D4AA]/60 rounded-full transition-all duration-300"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>
        )}

        {state.status === 'done' && (
          <div onClick={(e) => { e.stopPropagation(); setState({ status: 'idle' }) }}>
            <p className="font-mono text-[10px] text-[#00D4AA]">✓ {state.filename}</p>
            <p className="font-mono text-[9px] text-white/30 mt-0.5">{state.chunks} chunk{state.chunks !== 1 ? 's' : ''} indexed</p>
            <p className="font-mono text-[9px] text-white/20 mt-1">Click to upload another</p>
          </div>
        )}

        {state.status === 'error' && (
          <div onClick={(e) => { e.stopPropagation(); setState({ status: 'idle' }) }}>
            <p className="font-mono text-[10px] text-red-400/80">{state.message}</p>
            <p className="font-mono text-[9px] text-white/20 mt-1">Click to retry</p>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
