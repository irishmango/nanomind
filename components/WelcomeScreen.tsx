'use client'

import { useChat } from '@/context/ChatContext'

const STARTER_CARDS = [
  {
    icon: '⬡',
    title: 'Raman fingerprinting',
    prompt: 'What Raman peaks are characteristic of MoS₂ monolayer, and how do they shift with layer number?',
  },
  {
    icon: '⚗',
    title: 'Synthesis design',
    prompt: 'Design a CVD protocol for growing large-area MoS₂ monolayers on SiO₂/Si substrates.',
  },
  {
    icon: '◈',
    title: 'Bandgap engineering',
    prompt: 'How does quantum confinement affect the bandgap of TiO₂ nanoparticles below 10 nm?',
  },
  {
    icon: '◎',
    title: 'Photocatalysis mechanism',
    prompt: 'Explain the photocatalytic water-splitting mechanism in anatase TiO₂ and key efficiency bottlenecks.',
  },
]

export default function WelcomeScreen() {
  const { sendMessage, activeMaterials } = useChat()

  const headline =
    activeMaterials.length === 1
      ? `Research co-pilot for ${activeMaterials[0].name}`
      : activeMaterials.length > 1
        ? `Research co-pilot for ${activeMaterials.map((m) => m.formula ?? m.name).join(', ')}`
        : 'Your nanoscience research co-pilot'

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 select-none">
      {/* Logo / headline */}
      <div className="mb-10 text-center">
        <p className="font-mono text-[#00D4AA] text-xs tracking-[0.3em] uppercase mb-3 opacity-70">
          NanoMind
        </p>
        <h1 className="font-sans text-2xl font-semibold text-white/80 leading-tight">
          {headline}
        </h1>
        <p className="mt-2 font-mono text-xs text-white/25 max-w-sm">
          Ask about synthesis, characterisation, properties, or experimental design.
        </p>
      </div>

      {/* Starter cards grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-xl">
        {STARTER_CARDS.map((card) => (
          <button
            key={card.title}
            onClick={() => sendMessage(card.prompt)}
            className="text-left rounded-xl p-4 border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.14] transition-all group"
          >
            <span className="block font-mono text-lg text-white/20 mb-2 group-hover:text-[#00D4AA]/40 transition-colors">
              {card.icon}
            </span>
            <p className="font-sans text-xs font-medium text-white/60 group-hover:text-white/80 leading-snug transition-colors">
              {card.title}
            </p>
            <p className="mt-1 font-mono text-[10px] text-white/25 leading-relaxed line-clamp-2">
              {card.prompt}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
