'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useChat } from '@/context/ChatContext'
import MessageList from '@/components/MessageList'
import InputBar from '@/components/InputBar'
import WelcomeScreen from '@/components/WelcomeScreen'
import SpectraPanel from '@/components/SpectraPanel'

type Tab = 'chat' | 'spectra'

export default function Home() {
  const { messages, activeMaterial, agentMode, setAgentMode } = useChat()
  const [tab, setTab] = useState<Tab>('chat')

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]">
        <div className="flex-1 min-w-0">
          {activeMaterial ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-white/30 uppercase tracking-widest">
                Material
              </span>
              <span className="font-mono text-xs text-[#00D4AA] truncate">
                {activeMaterial.formula ?? activeMaterial.name}
              </span>
              <span className="font-sans text-xs text-white/40 truncate hidden sm:block">
                — {activeMaterial.name}
              </span>
            </div>
          ) : (
            <span className="font-mono text-xs text-white/20">
              No material selected — select one from the sidebar
            </span>
          )}
        </div>

        {/* Notebook link */}
        <Link
          href="/notebook"
          className="shrink-0 px-2.5 py-1 rounded-md font-mono text-[11px] text-white/25 border border-white/[0.08] hover:text-white/50 hover:border-white/20 transition-colors"
        >
          ◈ Notebook
        </Link>

        {/* Agent mode toggle */}
        <button
          onClick={() => setAgentMode(!agentMode)}
          className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors
            ${agentMode
              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
              : 'text-white/25 border border-white/[0.08] hover:text-white/40'
            }`}
          title={agentMode ? 'Agent mode on — uses tools (Materials Project, HuggingFace)' : 'Enable agent mode'}
        >
          <span>{agentMode ? '◆' : '◇'}</span>
          <span>Agent</span>
        </button>

        {/* Tab switcher — only when material is selected */}
        {activeMaterial && (
          <div className="flex gap-1 shrink-0">
            {(['chat', 'spectra'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-md font-mono text-[11px] transition-colors
                  ${tab === t
                    ? 'bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30'
                    : 'text-white/30 border border-white/[0.08] hover:text-white/50 hover:border-white/20'
                  }`}
              >
                {t === 'chat' ? '⬡ Chat' : '◈ Spectra'}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Chat panel */}
      <div className={`flex flex-col flex-1 min-h-0 ${tab === 'chat' ? '' : 'hidden'}`}>
        {messages.length === 0 ? <WelcomeScreen /> : <MessageList />}
        <InputBar />
      </div>

      {/* Spectra panel — kept mounted to preserve state */}
      <div className={`flex-1 overflow-y-auto ${tab === 'spectra' ? '' : 'hidden'}`}>
        <SpectraPanel fullWidth />
      </div>
    </div>
  )
}
