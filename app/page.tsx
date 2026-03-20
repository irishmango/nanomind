'use client'

import { useEffect, useState } from 'react'
import { useChat } from '@/context/ChatContext'
import MessageList from '@/components/MessageList'
import InputBar from '@/components/InputBar'
import WelcomeScreen from '@/components/WelcomeScreen'
import SpectraPanel from '@/components/SpectraPanel'
import NotebookTab from '@/components/tabs/NotebookTab'
import DocumentsTab from '@/components/tabs/DocumentsTab'
import MaterialSelector from '@/components/MaterialSelector'

type Tab = 'chat' | 'spectra' | 'notebook' | 'documents'

const TAB_LABELS: Record<Tab, string> = {
  chat: '⬡ Chat',
  spectra: '◈ Spectra',
  notebook: '◈ Notebook',
  documents: '↑ Docs',
}

export default function Home() {
  const { messages, agentMode, setAgentMode, sessionId } = useChat()
  const [tab, setTab] = useState<Tab>('chat')

  useEffect(() => {
    setTab('chat')
  }, [sessionId])

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] min-h-[52px]">
        {/* Material selector — left side */}
        <div className="flex-1 min-w-0">
          <MaterialSelector />
        </div>

        {/* Live data toggle */}
        <button
          onClick={() => setAgentMode(!agentMode)}
          className={`shrink-0 flex flex-col items-start px-2.5 py-1.5 rounded-md font-mono transition-colors
            ${agentMode
              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
              : 'text-white/25 border border-white/[0.08] hover:text-white/40'
            }`}
        >
          <div className="flex items-center gap-1.5 text-[11px]">
            <span>{agentMode ? '◆' : '◇'}</span>
            <span>Live data</span>
          </div>
          <span className="text-[9px] leading-tight mt-0.5 opacity-70">
            {agentMode ? 'AI · papers · MP API' : 'Off: AI + papers  |  On: + MP API'}
          </span>
        </button>

        {/* Tab switcher — only when session is active */}
        {sessionId && (
          <div className="flex gap-1 shrink-0">
            {(['chat', 'spectra', 'notebook', 'documents'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-md font-mono text-[11px] transition-colors
                  ${tab === t
                    ? 'bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30'
                    : 'text-white/30 border border-white/[0.08] hover:text-white/50 hover:border-white/20'
                  }`}
              >
                {TAB_LABELS[t]}
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

      {/* Notebook tab */}
      {tab === 'notebook' && (
        <div className="flex flex-col flex-1 min-h-0">
          <NotebookTab sessionId={sessionId} />
        </div>
      )}

      {/* Documents tab */}
      {tab === 'documents' && (
        <div className="flex flex-col flex-1 min-h-0">
          <DocumentsTab sessionId={sessionId} />
        </div>
      )}
    </div>
  )
}
