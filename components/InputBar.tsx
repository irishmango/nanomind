'use client'

import { useRef, useState, useEffect, KeyboardEvent } from 'react'
import { useChat } from '@/context/ChatContext'

const QUICK_QUERIES = [
  'What are the characteristic Raman peaks for this material?',
  'Suggest an optimised CVD synthesis protocol.',
  'How does layer number affect the bandgap?',
  'What XPS binding energies should I expect?',
  'Compare anatase vs rutile phase stability.',
  'Design an experiment to measure photocatalytic activity.',
]

export default function InputBar() {
  const { sendMessage, stopGeneration, isLoading, messages } = useChat()
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize up to 120px
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [value])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const text = value.trim()
    if (!text || isLoading) return
    setValue('')
    sendMessage(text)
  }

  const showChips = messages.length === 0 && value === ''

  return (
    <div className="shrink-0 border-t border-white/[0.06] bg-[#0A0C0F] px-4 pt-3 pb-4">
      {/* Quick-query chips */}
      {showChips && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={isLoading}
              className="text-[11px] font-mono px-2.5 py-1 rounded-full
                border border-white/10 text-white/40 hover:text-white/70
                hover:border-white/20 transition-colors disabled:opacity-40
                bg-white/[0.02] hover:bg-white/[0.04] whitespace-nowrap"
            >
              {q.length > 48 ? q.slice(0, 47) + '…' : q}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <div className="flex-1 flex items-end gap-2 rounded-xl border border-white/[0.08]
          bg-white/[0.03] focus-within:border-[#00D4AA]/40 transition-colors px-3 py-2.5">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask about synthesis, characterisation, properties…"
            rows={1}
            className="flex-1 resize-none bg-transparent outline-none text-sm text-white/85
              font-sans placeholder:text-white/25 leading-relaxed disabled:opacity-50
              max-h-[120px] overflow-y-auto"
          />
        </div>

        {isLoading ? (
          <button
            onClick={stopGeneration}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg
              bg-[#FF5E5E] hover:bg-[#FF5E5E]/80 transition-colors animate-pulse"
            aria-label="Stop generation"
          >
            {/* Filled square stop icon */}
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#1a0505]">
              <rect x="4" y="4" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg
              bg-[#00D4AA] hover:bg-[#00D4AA]/90 disabled:bg-white/10
              text-[#0A0C0F] disabled:text-white/20 transition-colors
              disabled:cursor-not-allowed"
            aria-label="Send"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
          </button>
        )}
      </div>

      <p className="mt-1.5 text-[10px] font-mono text-white/20 text-center">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  )
}
