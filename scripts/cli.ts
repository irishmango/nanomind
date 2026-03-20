import { existsSync, readFileSync, writeFileSync } from 'fs'
import { createServer } from 'http'
import { resolve } from 'path'
import { config } from 'dotenv'
import chalk from 'chalk'
import ora from 'ora'
import open from 'open'
import next from 'next'
import { prompt } from 'enquirer'
import { createClient } from '@supabase/supabase-js'
import { runSetup } from './setup-db.js'

const ENV_PATH = resolve(process.cwd(), '.env.local')
const PORT = parseInt(process.env.PORT ?? '3000', 10)
const accent = chalk.hex('#00D4AA')
const dim = chalk.hex('#00D4AA').dim

// ── ASCII header ──────────────────────────────────────────────────────────────

function printHeader() {
  console.log()
  console.log(accent('  ┌─────────────────────────────────────┐'))
  console.log(accent('  │                                     │'))
  console.log(accent('  │  ⬡  ') + chalk.bold.hex('#00D4AA')('NANOMIND') + accent('                        │'))
  console.log(accent('  │  ') + dim('AI Research Co-Pilot             ') + accent('│'))
  console.log(accent('  │  ') + dim('Nanoscience & Materials Chemistry ') + accent('│'))
  console.log(accent('  └─────────────────────────────────────┘'))
  console.log()
}

// ── env helpers ───────────────────────────────────────────────────────────────

function isConfigured(): boolean {
  if (!existsSync(ENV_PATH)) return false
  const contents = readFileSync(ENV_PATH, 'utf-8')
  return (
    /NEXT_PUBLIC_SUPABASE_URL=https:\/\/\S+/.test(contents) &&
    /ANTHROPIC_API_KEY=\S+/.test(contents)
  )
}

function writeEnv(values: Record<string, string>) {
  const lines = [
    `NEXT_PUBLIC_SUPABASE_URL=${values.supabaseUrl}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${values.anonKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${values.serviceKey}`,
    `ANTHROPIC_API_KEY=${values.anthropicKey}`,
    `DATABASE_URL=${values.databaseUrl}`,
    `HUGGINGFACE_API_KEY=${values.hfKey}`,
    `MATERIALS_PROJECT_API_KEY=${values.mpKey}`,
  ]
  writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8')
}

// ── setup flow ────────────────────────────────────────────────────────────────

async function setupFlow() {
  console.log(chalk.white('  No configuration found. Let\'s set up NanoMind.\n'))

  const answers = await prompt<{
    supabaseUrl: string
    anonKey: string
    serviceKey: string
    anthropicKey: string
    databaseUrl: string
    hfKey: string
    mpKey: string
  }>([
    {
      type: 'input',
      name: 'supabaseUrl',
      message: 'Supabase project URL',
      hint: 'https://xxxx.supabase.co',
      validate: (v: string) => v.startsWith('https://') || 'Must start with https://',
    },
    {
      type: 'password',
      name: 'anonKey',
      message: 'Supabase publishable (anon) key',
      validate: (v: string) => v.length > 10 || 'Required',
    },
    {
      type: 'password',
      name: 'serviceKey',
      message: 'Supabase service role key (secret)',
      validate: (v: string) => v.length > 10 || 'Required',
    },
    {
      type: 'password',
      name: 'anthropicKey',
      message: 'Anthropic API key',
      hint: 'sk-ant-...',
      validate: (v: string) => v.length > 10 || 'Required',
    },
    {
      type: 'input',
      name: 'databaseUrl',
      message: 'Database URL (Postgres connection string)',
      hint: 'Supabase → Settings → Database → URI',
      validate: (v: string) => v.startsWith('postgresql://') || 'Must start with postgresql://',
    },
    {
      type: 'password',
      name: 'hfKey',
      message: 'HuggingFace API key (optional — for RAG embeddings)',
    },
    {
      type: 'password',
      name: 'mpKey',
      message: 'Materials Project API key (optional — for Live data mode)',
    },
  ])

  console.log()
  writeEnv(answers)
  console.log(accent('  ✓ .env.local written\n'))

  // Reload env so runSetup() can read it
  config({ path: ENV_PATH, override: true })

  // Run database setup with ora spinners
  const spinner = ora({ color: 'cyan' }).start('Connecting to database…')
  try {
    await runSetup({
      onStep: (msg) => {
        spinner.succeed(accent(msg))
        spinner.start()
      },
    })
    spinner.stop()
    console.log()
    console.log(accent('  ✓ NanoMind database ready.\n'))
  } catch (err) {
    spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)))
    console.log(chalk.dim('\n  Fix the error above, then run `npx nanomind` again.\n'))
    process.exit(1)
  }
}

// ── connection check ──────────────────────────────────────────────────────────

async function verifyConnection(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return false

  const spinner = ora('Verifying Supabase connection…').start()
  try {
    const supabase = createClient(url, key)
    const { error } = await supabase.from('materials').select('id', { count: 'exact', head: true })
    if (error) throw error
    spinner.succeed(accent('Supabase connected'))
    return true
  } catch (err) {
    spinner.fail(chalk.red(`Connection failed: ${err instanceof Error ? err.message : String(err)}`))
    return false
  }
}

// ── dev server ────────────────────────────────────────────────────────────────

async function launchServer() {
  const spinner = ora('Starting NanoMind…').start()

  const app = next({ dev: true, dir: process.cwd(), port: PORT })
  const handle = app.getRequestHandler()

  await app.prepare()

  const server = createServer((req, res) => {
    handle(req, res)
  })

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => resolve())
  })

  spinner.succeed(accent(`NanoMind running at http://localhost:${PORT}`))
  console.log(chalk.dim('  Press Ctrl+C to stop.\n'))

  await open(`http://localhost:${PORT}`)
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  printHeader()

  if (!isConfigured()) {
    await setupFlow()
  } else {
    config({ path: ENV_PATH })

    const ok = await verifyConnection()
    if (!ok) {
      const { rerun } = await prompt<{ rerun: boolean }>({
        type: 'confirm',
        name: 'rerun',
        message: 'Would you like to re-run database setup?',
      } as never)

      if (rerun) {
        await setupFlow()
      } else {
        console.log(chalk.dim('\n  Exiting. Fix your connection and try again.\n'))
        process.exit(1)
      }
    }
  }

  await launchServer()
}

main().catch((err) => {
  // enquirer throws '' on Ctrl+C
  if (!err || err === '') process.exit(0)
  console.error(chalk.red('\n  Error: ' + (err instanceof Error ? err.message : String(err))))
  process.exit(1)
})
