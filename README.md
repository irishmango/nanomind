# NanoMind

AI research co-pilot for nanoscience and materials chemistry. Upload papers, ask questions grounded in the literature, visualise spectra, and automatically log experimental findings.

## Screenshots

![Chat with RAG](public/nanomind_01.png)
![Agent mode](public/nanomind_02.png)
![Spectra visualiser](public/nanomind_03.png)
![Experiment notebook](public/nanomind_04.png)
![Experiment notebook](public/nanomind_05.png)

## Features

- **RAG chat** — upload PDF/TXT papers and ask questions anchored to retrieved context (BAAI/bge-base-en-v1.5 embeddings via HuggingFace + pgvector)
- **Multi-material context** — select one or more materials from a searchable topbar dropdown; context from all selected materials is injected into every response
- **Live data mode** — LangChain agent with Materials Project tools (crystal structure, properties) and HuggingFace QA
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

## Quick start

```bash
npx nanomind-ai
# or if that doesn't work:
npx nanomind-ai@latest
```

The CLI walks you through entering your API keys, provisions your Supabase database, and launches the app in your browser. Setup takes about 2 minutes.

### What you'll need

| Credential | Where to get it |
|---|---|
| Supabase URL + keys | [supabase.com](https://supabase.com) → Settings → API |
| Supabase Database URL | Settings → Database → Connection string (URI mode) |
| Anthropic API key | [console.anthropic.com](https://console.anthropic.com) |
| HuggingFace token *(optional)* | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) — enable "Make calls to Inference Providers" |
| Materials Project key *(optional)* | [materialsproject.org](https://materialsproject.org) → API keys |

### Developer setup

```bash
git clone https://github.com/irishmango/nanomind
cd nanomind
cp .env.example .env.local   # fill in your keys
npm install
npm run setup                 # provisions your Supabase project
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...

# Required for npm run setup (Supabase → Settings → Database → URI)
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# Optional — enables document embeddings and Live data mode
HUGGINGFACE_API_KEY=hf_...
MATERIALS_PROJECT_API_KEY=...
```

## Usage

1. **Select materials** — use the topbar dropdown to search and select one or more material contexts; selected materials appear as dismissible chips
2. **Start a session** — click New session in the sidebar
3. **Upload papers** — go to the Documents tab, drop a PDF or TXT file; it is embedded and scoped to the current session
4. **Ask questions** — answers are grounded in uploaded documents and selected material context
5. **Enable Live data** — toggle Live data in the toolbar to activate the Materials Project + HuggingFace agent
6. **View spectra** — go to the Spectra tab, drop an XY/CSV file, click Analyse
7. **Browse notebook** — the Notebook tab shows all auto-logged findings; filter by technique or confidence and export CSV

## Architecture

```
app/
  api/
    chat/              # Streaming Anthropic chat with RAG injection
    agent/             # LangChain AgentExecutor with MP + HF tools
    documents/upload/  # PDF parsing + HuggingFace embeddings
    spectra/analyze/   # Streaming peak annotation
    sessions/          # CRUD for chat sessions
    materials/         # Materials list + create
    notebook/          # Notebook entry CRUD
  page.tsx             # Session view: Chat · Spectra · Notebook · Documents tabs
  layout.tsx           # Root layout with env validation banner

components/
  MaterialSelector.tsx # Topbar multi-select dropdown with search and chips
  Sidebar.tsx          # Session history, new session button
  MessageList.tsx      # Chat thread with markdown, tool steps, source badges
  InputBar.tsx         # Auto-resize textarea, quick-query chips
  SpectraPanel.tsx     # Spectra drop zone + AI annotation
  SpectraChart.tsx     # Recharts ComposedChart with peak markers
  ConfirmModal.tsx     # Reusable deletion confirmation overlay
  WelcomeScreen.tsx    # Empty state shown before first session
  EnvWarningBanner.tsx # Missing env var warnings
  tabs/
    NotebookTab.tsx    # Session-scoped notebook with filters + CSV export
    DocumentsTab.tsx   # Session-scoped upload zone + document list

context/
  ChatContext.tsx      # Streaming chat state, agent mode, multi-material context

lib/
  chunker.ts           # RecursiveCharacterTextSplitter with section labels
  retriever.ts         # HuggingFace embed + pgvector similarity search
  agent.ts             # LangChain agent factory
  tools/               # MaterialsProject + HuggingFace tool definitions
  validateEnv.ts       # Startup env var validation
  prompts/             # Nanoscience system prompt
```
