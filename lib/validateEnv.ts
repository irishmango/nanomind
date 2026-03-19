const REQUIRED: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: 'Supabase project URL',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'Supabase anon key',
  SUPABASE_SERVICE_ROLE_KEY: 'Supabase service role key',
  ANTHROPIC_API_KEY: 'Anthropic API key (required for chat)',
}

const OPTIONAL: Record<string, string> = {
  HUGGINGFACE_API_KEY: 'HuggingFace token (required for document embeddings)',
  MATERIALS_PROJECT_API_KEY: 'Materials Project key (required for agent tools)',
}

export type EnvValidation = {
  ok: boolean
  missing: string[]
  warnings: string[]
}

export function validateEnv(): EnvValidation {
  const missing: string[] = []
  const warnings: string[] = []

  for (const [key, label] of Object.entries(REQUIRED)) {
    if (!process.env[key]) missing.push(`${key} — ${label}`)
  }

  for (const [key, label] of Object.entries(OPTIONAL)) {
    if (!process.env[key]) warnings.push(`${key} — ${label}`)
  }

  if (missing.length > 0) {
    console.error(
      `\n[NanoMind] Missing required environment variables:\n${missing.map((m) => `  ✗ ${m}`).join('\n')}\n`,
    )
  }
  if (warnings.length > 0) {
    console.warn(
      `\n[NanoMind] Missing optional environment variables (some features disabled):\n${warnings.map((w) => `  ⚠ ${w}`).join('\n')}\n`,
    )
  }

  return { ok: missing.length === 0, missing, warnings }
}
