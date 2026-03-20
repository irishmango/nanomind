n# NanoMind

AI research co-pilot for nanoscience and materials chemistry. Upload papers, ask questions grounded in the literature, visualise spectra, and automatically log experimental findings.

## Screenshots

![Chat with RAG](public/nanomind_01.png)
![Agent mode](public/nanomind_02.png)
![Spectra visualiser](public/nanomind_03.png)
![Experiment notebook](public/nanomind_04.png)
![Experiment notebook](public/nanomind_05.png)

## Features

- **RAG chat** — upload PDF/TXT papers and ask questions anchored to retrieved context (BAAI/bge-base-en-v1.5 embeddings via HuggingFace + pgvector)
- **Agent mode** — LangChain agent with Materials Project tools (crystal structure, properties) and HuggingFace QA
- **Spectra visualiser** — drop XY/CSV/TXT spectral data; AI annotates peaks in real time
- **Experiment notebook** — findings auto-extracted from every chat response and logged to a searchable, filterable table with CSV export
- **Session persistence** — conversations survive page refresh; full session history in the sidebar

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router, Turbopack) |
| UI | React 19, Tailwind v4, Recharts v3 |
| Database | Supabase (Postgres + pgvector) |
| LLM (chat) | Anthropic claude-sonnet-4-6 |
| LLM (extraction) | Anthropic claude-haiku-4-5 |
| Embeddings | HuggingFace BAAI/bge-base-en-v1.5 (768-dim) |
| Agent | LangChain 0.3 + @langchain/anthropic |
| Auth | Supabase anon key (RLS enabled) |

## Setup

```bash
git clone https://github.com/yourname/nanomind
cd nanomind
cp .env.example .env.local   # fill in your keys
npm install
npm run setup                 # provisions your Supabase project
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...

# Required for npm run setup (Supabase dashboard → Settings → Database → URI)
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# Optional — enables document embeddings and agent tools
HUGGINGFACE_API_KEY=hf_...
MATERIALS_PROJECT_API_KEY=...
```

**Supabase**: create a free project at [supabase.com](https://supabase.com). Find `DATABASE_URL` under Settings → Database → Connection string (URI mode).

**HuggingFace token**: create a token at huggingface.co/settings/tokens — enable "Make calls to Inference Providers".

**Materials Project key**: register at next-gen.materialsproject.org → API keys.

## Usage

1. **Select a material** from the sidebar
2. **Upload a paper** (PDF or TXT) via the Upload panel — chunks are embedded and stored
3. **Ask questions** in chat — answers are grounded in the uploaded document
4. **Switch to Agent mode** (◆ Agent button) to enable Materials Project + HuggingFace tools
5. **View spectra** — click the Spectra tab, drop an XY/CSV file, hit Analyse
6. **Browse notebook** — click ◈ Notebook to see all auto-logged findings, filter, and export CSV

## Architecture

```
app/
  api/
    chat/              # Streaming Anthropic chat with RAG injection
    agent/             # LangChain AgentExecutor with MP + HF tools
    documents/upload/  # PDF parsing + HuggingFace embeddings
    spectra/analyze/   # Streaming peak annotation
    sessions/          # CRUD for chat sessions
    materials/         # Materials list
    notebook/          # Notebook entry CRUD
  page.tsx             # Chat + Spectra tabs
  notebook/            # Experiment notebook UI
  layout.tsx           # Root layout with env validation banner

components/
  Sidebar.tsx          # Material selector, session history, upload
  MessageList.tsx      # Chat thread with markdown + retry on error
  InputBar.tsx         # Auto-resize textarea, quick-query chips
  SpectraPanel.tsx     # Spectra drop zone + AI annotation
  SpectraChart.tsx     # Recharts ComposedChart with peak markers
  EnvWarningBanner.tsx # Missing env var warnings

lib/
  chunker.ts           # RecursiveCharacterTextSplitter with section labels
  retriever.ts         # HuggingFace embed + pgvector similarity search
  agent.ts             # LangChain agent factory
  tools/               # MaterialsProject + HuggingFace tool definitions
  validateEnv.ts       # Startup env var validation
  prompts/             # Nanoscience system prompt
```
