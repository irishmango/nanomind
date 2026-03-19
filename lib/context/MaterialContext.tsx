'use client'

import { createContext, useContext, useState } from 'react'

export type Material = {
  id: string
  name: string
  formula: string | null
  description: string | null
  tags: string[] | null
  created_at: string
}

type MaterialContextValue = {
  activeMaterial: Material | null
  setActiveMaterial: (m: Material | null) => void
  activeSession: string | null
  setActiveSession: (id: string | null) => void
}

const MaterialContext = createContext<MaterialContextValue | null>(null)

export function MaterialProvider({ children }: { children: React.ReactNode }) {
  const [activeMaterial, setActiveMaterial] = useState<Material | null>(null)
  const [activeSession, setActiveSession] = useState<string | null>(null)

  return (
    <MaterialContext.Provider
      value={{ activeMaterial, setActiveMaterial, activeSession, setActiveSession }}
    >
      {children}
    </MaterialContext.Provider>
  )
}

export function useMaterial() {
  const ctx = useContext(MaterialContext)
  if (!ctx) throw new Error('useMaterial must be used inside MaterialProvider')
  return ctx
}
