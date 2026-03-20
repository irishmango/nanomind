'use client'

import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChat, type ToolCall, type ClarifyOption } from '@/context/ChatContext'

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#00D4AA]/60"
          style={{
            animation: 'typing-bounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function AgentThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <span className="text-purple-400/70 text-xs">🔍</span>
      <span className="font-mono text-[11px] text-purple-300/60 animate-pulse">
        Querying Materials Project…
      </span>
    </div>
  )
}

function ToolCallStep({ toolCalls }: { toolCalls: ToolCall[] }) {
  return (
    <div className="mb-2 space-y-1">
      {toolCalls.map((tc, i) => (
        <div key={i} className="flex items-start gap-2 font-mono text-[10px]">
          <span className="text-purple-400/80 mt-px">✓</span>
          <div className="min-w-0">
            <span className="text-purple-300/70">{tc.input || tc.tool}</span>
            {tc.result && (
              <>
                <span className="text-white/20 mx-1">—</span>
                <span className="text-white/40 truncate">{tc.result.slice(0, 100)}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function ClarifyButtons({ options, onSelect }: { options: ClarifyOption[]; onSelect: (label: string) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.label)}
          className="px-3 py-1.5 rounded-lg font-mono text-[11px] border
            text-purple-300/80 border-purple-400/30 bg-purple-400/[0.06]
            hover:bg-purple-400/[0.12] hover:border-purple-400/50 hover:text-purple-200
            transition-colors"
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function SourcePill({ label }: { label: string }) {
  const isMP = label === 'Materials Project'
  const isFile = /\.(pdf|txt|md)$/i.test(label)
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[9px] px-1.5 py-0.5 rounded
      ${isMP
        ? 'text-amber-400/70 bg-amber-400/[0.08] border border-amber-400/20'
        : isFile
        ? 'text-[#00D4AA]/50 bg-[#00D4AA]/[0.06] border border-[#00D4AA]/15'
        : 'text-white/20 bg-white/[0.03] border border-white/[0.06]'
      }`}>
      {isMP ? '◆' : isFile ? '◈' : '◇'} {isFile ? `via ${label}` : label}
    </span>
  )
}

function SourceBadge({ source, sources }: { source?: string; sources?: string[] }) {
  const items = sources ?? (source ? [source] : [])
  if (items.length === 0) return null
  // Normalise legacy "via Materials Project" strings from non-agent mode
  const normalised = items.map((s) => s.replace(/^via /, ''))
  return (
    <div className="mt-2 pt-2 border-t border-white/[0.05] flex flex-wrap gap-1.5">
      {normalised.map((s) => <SourcePill key={s} label={s} />)}
    </div>
  )
}

export default function MessageList() {
  const { messages, isLoading, retryLast, sendMessage } = useChat()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 select-none">
        <p className="font-mono text-2xl text-white/10">⬡</p>
        <p className="font-mono text-xs text-white/20 tracking-widest uppercase">
          Ask a question to begin
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {msg.role === 'assistant' && (
            <div className="shrink-0 w-6 h-6 rounded-full bg-[#00D4AA]/15 border border-[#00D4AA]/30 flex items-center justify-center mt-0.5">
              <span className="text-[8px] font-mono text-[#00D4AA]">N</span>
            </div>
          )}

          <div className="max-w-[80%] flex flex-col gap-1">
            {/* Tool call step — shown above the bubble */}
            {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
              <ToolCallStep toolCalls={msg.toolCalls} />
            )}

            <div
              className={`rounded-xl px-4 py-3 text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-[#00D4AA]/10 border border-[#00D4AA]/20 text-white/90 font-sans'
                  : 'bg-white/[0.04] border border-white/[0.08] text-white/85'
                }`}
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : msg.streaming && msg.content === '' ? (
                msg.isAgent ? <AgentThinkingIndicator /> : <TypingIndicator />
              ) : (
                <div className="prose prose-invert prose-sm max-w-none
                  prose-p:leading-relaxed prose-p:my-1
                  prose-headings:font-mono prose-headings:text-white/90 prose-headings:font-semibold
                  prose-h2:text-sm prose-h2:mt-4 prose-h2:mb-2
                  prose-h3:text-xs prose-h3:mt-3 prose-h3:mb-1.5
                  prose-strong:text-white/90 prose-strong:font-semibold
                  prose-code:font-mono prose-code:text-[#00D4AA] prose-code:text-xs
                  prose-code:bg-[#00D4AA]/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                  prose-code:before:content-none prose-code:after:content-none
                  prose-pre:bg-white/[0.05] prose-pre:border prose-pre:border-white/[0.08]
                  prose-pre:rounded-lg prose-pre:p-3 prose-pre:overflow-x-auto
                  prose-pre:text-xs prose-pre:font-mono
                  prose-blockquote:border-l-[#00D4AA]/40 prose-blockquote:text-white/50
                  prose-blockquote:not-italic
                  prose-table:text-xs prose-table:font-mono
                  prose-th:text-white/60 prose-th:font-semibold prose-th:border-white/10
                  prose-td:border-white/[0.06] prose-td:text-white/70
                  prose-hr:border-white/[0.08]
                  prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                  {msg.streaming && (
                    <span className="inline-block w-0.5 h-3.5 bg-[#00D4AA] ml-0.5 animate-pulse align-middle" />
                  )}
                  {!msg.streaming && msg.content.startsWith('[error') && (
                    <button
                      onClick={retryLast}
                      disabled={isLoading}
                      className="mt-2 flex items-center gap-1 font-mono text-[10px] text-red-400/70 hover:text-red-300 transition-colors disabled:opacity-40"
                    >
                      ↺ Retry
                    </button>
                  )}
                  {!msg.streaming && msg.clarifyOptions && msg.clarifyOptions.length > 0 && (
                    <ClarifyButtons
                      options={msg.clarifyOptions}
                      onSelect={(label) => sendMessage(label)}
                    />
                  )}
                  {!msg.streaming && (msg.source || msg.sources) && (
                    <SourceBadge source={msg.source} sources={msg.sources} />
                  )}
                </div>
              )}
            </div>
          </div>

          {msg.role === 'user' && (
            <div className="shrink-0 w-6 h-6 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mt-0.5">
              <span className="text-[8px] font-mono text-white/40">U</span>
            </div>
          )}
        </div>
      ))}

      {isLoading && messages.at(-1)?.role !== 'assistant' && (
        <div className="flex gap-3 justify-start">
          <div className="shrink-0 w-6 h-6 rounded-full bg-[#00D4AA]/15 border border-[#00D4AA]/30 flex items-center justify-center mt-0.5">
            <span className="text-[8px] font-mono text-[#00D4AA]">N</span>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl">
            <TypingIndicator />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
