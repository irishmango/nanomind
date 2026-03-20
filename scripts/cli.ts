#!/usr/bin/env tsx

import { existsSync, readFileSync, writeFileSync, cpSync } from 'fs'
import { spawn, execSync } from 'child_process'
import { resolve } from 'path'
import { config } from 'dotenv'
import chalk from 'chalk'
import ora from 'ora'
import open from 'open'
import { prompt } from 'enquirer'
import { createClient } from '@supabase/supabase-js'
import { runSetup } from './setup-db.js'

// When run via npx, __dirname is the package's scripts/ dir inside the npx cache.
// PKG_ROOT is the package root one level up — contains app/, components/, etc.
const PKG_ROOT = resolve(__dirname, '..')
const CWD = process.cwd()
const ENV_PATH = resolve(CWD, '.env.local')
const PORT = parseInt(process.env.PORT ?? '3000', 10)
const accent = chalk.hex('#00D4AA')
const dim = chalk.hex('#00D4AA').dim

// ── ASCII header ───────────────────────────────────────────────────────────────

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

// ── project detection ─────────────────────────────────────────────────────────

function isNanoMindProject(): boolean {
  return existsSync(resolve(CWD, 'next.config.ts')) || existsSync(ENV_PATH)
}

function isConfigured(): boolean {
  if (!existsSync(ENV_PATH)) return false
  const contents = readFileSync(ENV_PATH, 'utf-8')
  return (
    /NEXT_PUBLIC_SUPABASE_URL=https:\/\/\S+/.test(contents) &&
    /ANTHROPIC_API_KEY=\S+/.test(contents)
  )
}

// ── scaffold ──────────────────────────────────────────────────────────────────

function scaffoldProject() {
  const spinner = ora('Creating project files…').start()
  const dirs = ['app', 'components', 'context', 'lib', 'public', 'scripts']
  const files = [
    'next.config.ts',
    'tsconfig.json',
    'tailwind.config.ts',
    'postcss.config.mjs',
    '.env.example',
    'package.json',
  ]

  for (const dir of dirs) {
    const src = resolve(PKG_ROOT, dir)
    if (existsSync(src)) cpSync(src, resolve(CWD, dir), { recursive: true })
  }
  for (const file of files) {
    const src = resolve(PKG_ROOT, file)
    if (existsSync(src)) cpSync(src, resolve(CWD, file))
  }
  spinner.succeed(accent('Project files created'))
}

function installDependencies() {
  const spinner = ora('Installing dependencies (this may take a minute)…').start()
  try {
    execSync('npm install', { cwd: CWD, stdio: 'pipe' })
    spinner.succeed(accent('Dependencies installed'))
  } catch (err) {
    spinner.fail(chalk.red('npm install failed'))
    throw err
  }
}

// ── env helpers ────────────────────────────────────────────────────────────────

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

// ── prompts ───────────────────────────────────────────────────────────────────

async function promptForKeys() {
  return prompt<{
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
      message: 'Supabase project URL (https://xxxx.supabase.co)',
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
      message: 'Anthropic API key (sk-ant-...)',
      validate: (v: string) => v.length > 10 || 'Required',
    },
    {
      type: 'input',
      name: 'databaseUrl',
      message: 'Database URL — Supabase → Settings → Database → URI',
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
}

// ── database setup ────────────────────────────────────────────────────────────

async function runDbSetup() {
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
    console.log(chalk.dim('\n  Fix the error above, then run `npx nanomind-ai` again.\n'))
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

function launchServer() {
  console.log(accent(`  Starting NanoMind at http://localhost:${PORT}`))
  console.log(chalk.dim('  Press Ctrl+C to stop.\n'))

  const child = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
    cwd: CWD,
  })

  setTimeout(() => {
    open(`http://localhost:${PORT}`)
  }, 3000)

  child.on('exit', (code) => {
    process.exit(code ?? 0)
  })
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  printHeader()

  if (!isNanoMindProject()) {
    // Fresh install — user ran npx nanomind-ai from an empty directory
    const g = chalk.dim.gray
    const a = accent
    console.log(chalk.white('  NanoMind is an open-source AI research co-pilot for'))
    console.log(chalk.white('  nanoscience and materials chemistry. It runs locally'))
    console.log(chalk.white('  in your browser and uses your own API keys — your data'))
    console.log(chalk.white('  never leaves your infrastructure.'))
    console.log()
    console.log(chalk.white('  Before we begin, you will need:'))
    console.log()
    console.log(a('  ◆ A Supabase account (free)') + g(' — supabase.com'))
    console.log(g('    Create a project and grab your URL + API keys from'))
    console.log(g('    Settings → API'))
    console.log()
    console.log(a('  ◆ An Anthropic API key') + g(' — console.anthropic.com'))
    console.log()
    console.log(a('  ◆ A HuggingFace token (free)') + g(' — huggingface.co/settings/tokens'))
    console.log(g('    Enable "Make calls to Inference Providers"'))
    console.log()
    console.log(a('  ◆ A Materials Project API key (free)') + g(' — materialsproject.org'))
    console.log(g('    ') + chalk.yellow('Optional') + g(' — enables live crystal structure + property lookups'))
    console.log()
    console.log(chalk.bold.white('  Setup takes about 2 minutes. Let\'s go.'))
    console.log(chalk.dim('  ──────────────────────────────────────────'))
    console.log()

    scaffoldProject()
    console.log()

    const answers = await promptForKeys()
    console.log()
    writeEnv(answers)
    console.log(accent('  ✓ .env.local written\n'))

    installDependencies()
    console.log()

    // Reload env so runSetup can read it
    config({ path: ENV_PATH, override: true })
    await runDbSetup()
  } else {
    // Existing project
    if (isConfigured()) {
      console.log(accent('  ✓ Environment found\n'))
    }

    config({ path: ENV_PATH })

    const ok = await verifyConnection()
    if (!ok) {
      const { rerun } = await prompt<{ rerun: boolean }>({
        type: 'confirm',
        name: 'rerun',
        message: 'Would you like to re-run database setup?',
      } as never)

      if (rerun) {
        config({ path: ENV_PATH, override: true })
        await runDbSetup()
      } else {
        console.log(chalk.dim('\n  Exiting. Fix your connection and try again.\n'))
        process.exit(1)
      }
    }
  }

  launchServer()
}

main().catch((err) => {
  // enquirer throws '' on Ctrl+C
  if (!err || err === '') process.exit(0)
  console.error(chalk.red('\n  Error: ' + (err instanceof Error ? err.message : String(err))))
  process.exit(1)
})
