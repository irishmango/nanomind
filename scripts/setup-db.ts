import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// ── exported setup function ───────────────────────────────────────────────────
// Reads from process.env — caller is responsible for loading .env.local first.

export async function runSetup(opts: {
  onStep: (msg: string) => void
}): Promise<void> {
  const { onStep } = opts

  const DATABASE_URL = process.env.DATABASE_URL
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is missing.\n  Find it in: Supabase → Settings → Database → Connection string (URI mode)',
    )
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.')
  }

  const pg = new Client({ connectionString: DATABASE_URL })
  await pg.connect()

  async function run(label: string, sql: string) {
    try {
      await pg.query(sql)
      onStep(label)
    } catch (err) {
      await pg.end().catch(() => {})
      throw new Error(`${label}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 1. pgvector
  await run('pgvector enabled', `create extension if not exists vector;`)

  // 2. tables
  await run('table: materials', `
    create table if not exists materials (
      id          uuid primary key default gen_random_uuid(),
      name        text not null,
      formula     text,
      description text,
      tags        text[] default '{}',
      created_at  timestamptz default now()
    );
  `)

  await run('table: sessions', `
    create table if not exists sessions (
      id           uuid primary key default gen_random_uuid(),
      material_ids uuid[] default '{}',
      title        text,
      created_at   timestamptz default now()
    );
  `)

  // Migrate existing tables: drop old FK column, add array column (both idempotent)
  await run('migrate: sessions.material_ids', `
    alter table sessions add column if not exists material_ids uuid[] default '{}';
    alter table sessions drop column if exists material_id;
  `)

  await run('table: messages', `
    create table if not exists messages (
      id         uuid primary key default gen_random_uuid(),
      session_id uuid references sessions(id) on delete cascade not null,
      role       text not null check (role in ('user', 'assistant')),
      content    text not null,
      created_at timestamptz default now()
    );
  `)

  await run('table: documents', `
    create table if not exists documents (
      id          uuid primary key default gen_random_uuid(),
      material_id uuid references materials(id) on delete cascade,
      session_id  uuid references sessions(id) on delete cascade,
      filename    text,
      chunk_index int,
      content     text not null,
      embedding   vector(768),
      metadata    jsonb default '{}',
      created_at  timestamptz default now()
    );
  `)

  await run('table: notebook_entries', `
    create table if not exists notebook_entries (
      id          uuid primary key default gen_random_uuid(),
      session_id  uuid references sessions(id) on delete cascade,
      material_id uuid references materials(id) on delete set null,
      technique   text not null default 'general',
      finding     text not null,
      confidence  text not null check (confidence in ('high', 'medium', 'low')),
      source      text not null default 'AI',
      created_at  timestamptz default now()
    );
  `)

  // 3. match_documents function
  await run('function: match_documents', `
    create or replace function match_documents(
      query_embedding  vector(768),
      match_threshold  float,
      match_count      int,
      match_session_id uuid default null
    )
    returns table (id uuid, content text, filename text, similarity float)
    language sql stable as $$
      select
        id,
        content,
        filename,
        1 - (embedding <=> query_embedding) as similarity
      from documents
      where
        (match_session_id is null or session_id = match_session_id)
        and 1 - (embedding <=> query_embedding) > match_threshold
      order by embedding <=> query_embedding
      limit match_count;
    $$;
  `)

  // 4. grants
  await run('grants applied', `
    grant select, insert, update, delete
      on all tables in schema public
      to anon, authenticated;
    grant execute on function match_documents to anon, authenticated;
  `)

  // 5. RLS
  for (const table of ['materials', 'sessions', 'messages', 'documents', 'notebook_entries']) {
    await run(`RLS enabled: ${table}`, `alter table ${table} enable row level security;`)
  }

  // 6. policies
  for (const table of ['materials', 'sessions', 'messages', 'documents', 'notebook_entries']) {
    await run(`policy: ${table}`, `
      do $$
      begin
        if not exists (
          select 1 from pg_policies
          where schemaname = 'public'
            and tablename  = '${table}'
            and policyname = 'allow all'
        ) then
          execute 'create policy "allow all" on ${table} for all using (true)';
        end if;
      end $$;
    `)
  }

  await pg.end()

  // 7. seed data via service role client
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const seeds = [
    {
      name: 'Molybdenum disulfide monolayer',
      formula: 'MoS₂',
      description: 'Single-layer TMD semiconductor with direct bandgap, widely studied for optoelectronics.',
      tags: ['2D material', 'TMD'],
    },
    {
      name: 'Titanium dioxide nanoparticles',
      formula: 'TiO₂',
      description: 'Wide-bandgap semiconductor used in photocatalysis and solar cells.',
      tags: ['photocatalyst', 'nanoparticles'],
    },
    {
      name: 'Tungsten diselenide bilayer',
      formula: 'WSe₂',
      description: 'Bilayer TMD with indirect bandgap, relevant for valleytronics research.',
      tags: ['2D material', 'TMD'],
    },
  ]

  for (const seed of seeds) {
    const { data: existing } = await supabase
      .from('materials')
      .select('id')
      .eq('name', seed.name)
      .maybeSingle()

    if (existing) {
      onStep(`seed skipped (exists): ${seed.name}`)
    } else {
      const { error } = await supabase.from('materials').insert(seed)
      if (error) throw new Error(`Seed "${seed.name}": ${error.message}`)
      onStep(`seed inserted: ${seed.name}`)
    }
  }
}

// ── standalone entry point (`npm run setup`) ──────────────────────────────────

const isMain = Boolean(
  process.argv[1] && (
    process.argv[1].endsWith('setup-db.ts') ||
    process.argv[1].endsWith('setup-db.js')
  ),
)

if (isMain) {
  config({ path: resolve(process.cwd(), '.env.local') })
  console.log('\nNanoMind — database setup\n')
  runSetup({ onStep: (msg) => console.log(`  ✓ ${msg}`) })
    .then(() => { console.log('\n  ✓ NanoMind database ready.\n') })
    .catch((err) => {
      console.error(`\n  ✗ ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    })
}
