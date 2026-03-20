import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

// ── env ───────────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL is missing from .env.local')
  console.error('  Find it in: Supabase dashboard → Settings → Database → Connection string (URI mode)')
  process.exit(1)
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from .env.local')
  process.exit(1)
}

// ── helpers ───────────────────────────────────────────────────────────────────

function ok(msg: string) {
  console.log(`  ✓ ${msg}`)
}

function fail(msg: string, err: unknown) {
  const detail = err instanceof Error ? err.message : String(err)
  console.error(`  ✗ ${msg}`)
  console.error(`    ${detail}`)
  process.exit(1)
}

async function run(client: Client, label: string, sql: string) {
  try {
    await client.query(sql)
    ok(label)
  } catch (err) {
    fail(label, err)
  }
}

// ── schema steps ──────────────────────────────────────────────────────────────

async function main() {
  console.log('\nNanoMind — database setup\n')

  const pg = new Client({ connectionString: DATABASE_URL })
  await pg.connect()

  // 1. pgvector
  await run(pg, 'pgvector enabled', `create extension if not exists vector;`)

  // 2. tables
  await run(pg, 'table: materials created', `
    create table if not exists materials (
      id          uuid primary key default gen_random_uuid(),
      name        text not null,
      formula     text,
      description text,
      tags        text[] default '{}',
      created_at  timestamptz default now()
    );
  `)

  await run(pg, 'table: sessions created', `
    create table if not exists sessions (
      id          uuid primary key default gen_random_uuid(),
      material_id uuid references materials(id) on delete set null,
      title       text,
      created_at  timestamptz default now()
    );
  `)

  await run(pg, 'table: messages created', `
    create table if not exists messages (
      id         uuid primary key default gen_random_uuid(),
      session_id uuid references sessions(id) on delete cascade not null,
      role       text not null check (role in ('user', 'assistant')),
      content    text not null,
      created_at timestamptz default now()
    );
  `)

  await run(pg, 'table: documents created', `
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

  await run(pg, 'table: notebook_entries created', `
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
  await run(pg, 'function: match_documents created', `
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
  await run(pg, 'grants applied', `
    grant select, insert, update, delete
      on all tables in schema public
      to anon, authenticated;
    grant execute on function match_documents to anon, authenticated;
  `)

  // 5. RLS
  for (const table of ['materials', 'sessions', 'messages', 'documents', 'notebook_entries']) {
    await run(pg, `RLS enabled: ${table}`, `alter table ${table} enable row level security;`)
  }

  // 6. policies (IF NOT EXISTS supported in Postgres 15+; use DO block for safety)
  for (const table of ['materials', 'sessions', 'messages', 'documents', 'notebook_entries']) {
    await run(pg, `policy: ${table}`, `
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

  // 7. seed data — via service role client so RLS is bypassed cleanly
  console.log()
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!)

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
      ok(`seed skipped (already exists): ${seed.name}`)
    } else {
      const { error } = await supabase.from('materials').insert(seed)
      if (error) fail(`seed: ${seed.name}`, error.message)
      else ok(`seed inserted: ${seed.name}`)
    }
  }

  console.log()
  console.log('  ✓ NanoMind database ready.')
  console.log()
}

main()
