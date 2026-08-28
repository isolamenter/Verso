# Verso — AI Literary Editorial Studio & Craft Workbench (v1.1)

<div align="center">

**English** | **[简体中文](./README_zh.md)**

<br/>

*“Words rest like still water, awaiting deliberate craft.”*

**Verso** is an Agent-first AI literary editorial studio and craft workbench purpose-built for authors of literary fiction, short stories, essays, poetry, and serious non-fiction.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?style=flat-square)](https://react.dev/)
[![React Router](https://img.shields.io/badge/React_Router-8.3-red.svg?style=flat-square)](https://reactrouter.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17_pgvector-336791.svg?style=flat-square)](https://github.com/pgvector/pgvector)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg?style=flat-square)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-amber.svg?style=flat-square)](./LICENSE)

</div>

---

## 📖 Philosophy & Core Principles

Unlike commercial AI ghostwriters or boilerplate web-novel generators, Verso adheres to strictly restrained principles of serious literary editing:

1. **Author First**: AI never mutates your prose directly. The manuscript remains the sole Source of Truth. AI acts strictly as an analytical lens, proposing non-destructive Change Sets for line-by-line review.
2. **Critique Before Generation**: Verso eliminates patronizing praise (*“vivid imagery”, “captivating story”*). It provides objective literary diagnostics first, followed by tiered, surgical proposals.
3. **Subtractive Editing**: Great writing is often the art of subtraction. AI identifies authorial over-explanation, exposed thematic concepts, emotion naming, redundant modifiers, and clichés.
4. **Trade-off Deliberation**: Every edit has a cost. Rather than claiming a revision is strictly "better", AI breaks down what is gained (e.g., heightened restraint, poetic ambiguity) versus what is sacrificed (e.g., increased reader cognitive load, softened dramatic immediacy).
5. **Server-Controlled Security & Local-First Privacy**: Model keys and endpoints are configured exclusively on the server (`.env`) and never exposed to the client. Verso binds strictly to loopback addresses (`127.0.0.1:4173`) by default to prevent accidental network exposure.

---

## 🏗️ Architecture

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                        Verso Client (React 19)                            │
│  ┌───────────────────────┬──────────────────────┬──────────────────────┐  │
│  │ Manuscript Viewer     │ Knowledge Lineage    │ Agent Workbench      │  │
│  │ (Two-Pane Read/Edit)  │ (Entities & Sources) │ (Thread & Receipts)  │  │
│  └───────────────────────┴──────────────────────┴──────────────────────┘  │
│                   ▲ Change Set Review (Diff & Anchoring)                   │
├───────────────────┼───────────────────────────────────────────────────────┤
│                   ▼ Server-Sent Events (SSE) & REST                       │
│                        Verso Server (Express)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Agent Runtime • Context Engine • Tool Bus • Monotonic Event Stream  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Domain Services: Projects, Manuscripts, ChangeSets, Knowledge, Skills│  │
│  └─────────────────────────────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────────────────────────┤
│                          Asynchronous Workers                             │
│  PgBoss Job Runner • Multimedia Ingestion (Text, Docx, Audio, Video)      │
├───────────────────────────────────────────────────────────────────────────┤
│                          Persistence & Models                             │
│  PostgreSQL 17 (pgvector) • Local Content-Addressed Media Storage         │
│  Server-side OpenAI-compatible LLM Gateway (DeepSeek, OpenAI, Ollama, etc.)│
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Key Capabilities

* **Two-Pane Workspace**: Seamlessly inspect and read manuscripts in read-only mode, or switch into manual editing mode with zero distraction. Includes a TipTap-powered editor with find-and-replace, rich formatting (headings, blockquotes, bold/italic), undo/redo, and live character/reading-time statistics.
* **Manuscript Import — Workspace & Scene Level**: Create a project directly from an existing manuscript (`.docx` / `.txt` / `.md`) with browser-side parsing via `mammoth` + HTML sanitization, or import into the workbench as a new scene or replacement for the current scene. Supports drag-and-drop, paste-from-clipboard, and automatic title/word-count extraction. Legacy `.doc` is rejected with a guided upgrade hint.
* **AI Scene / Chapter Splitting (Anchor-Based, Lossless)**: The Agent can be asked to restructure a long manuscript into multiple scenes or chapters via the `propose_scene_splits` tool. Instead of echoing full text, it returns a `split_scene` Change Set containing only per-scene `startQuote` anchors (15–30 chars), titles, summaries, and optional POV/timeframe. Server-side `splitManuscriptTextByAnchors` resolves anchors monotonically with exact → fuzzy → prefix fallback, validates full coverage (`computeSplitCoverage`), and on approval atomically rewrites the target scene plus inserts sibling scenes with correct ordering and revision history.
* **Skill-Aware Agent Workbench**: The Agent runtime now exposes a declared tool bus (`propose_scene_splits`, `propose_text_change`, `list_resources`, `read_resource` with `offset`/`maxLength` pagination for long novels) and runs a multi-turn loop (up to 3 turns). A selectable Skill lens (`SkillSelector`) assembles a skill-specific system prompt and filters the active tool set; skills declare `contextPolicy` (knowledge/memory inclusion) and `supportedTools`. Events are broadcast immediately over SSE with a monotonic `sequenceNumber` for zero-delay streaming.
* **Persistent Agent Thread & Context Receipts**: Consult with a dedicated literary editor that remembers character notes, world rules, and past critiques with exact token budgets and context citations. Includes thought-stream deltas, tool-call/tool-result transparency, and per-resource read receipts.
* **Non-Destructive Change Sets**: AI proposals appear as reviewable change sets with prefix/suffix context anchors (now also `split_scene` with coverage and per-scene ranges), allowing atomic acceptance, rejection, or manual fine-tuning without losing formatting. Diff viewer supports both side-by-side and inline modes.
* **Hierarchical Knowledge Lineage**: Organize characters, motifs, world-building notes, and uploaded source materials with vector-enabled semantic retrieval. Category and authority filters, paginated knowledge cards, and segment viewers for media assets.
* **Multimedia Ingestion**: Upload research materials (`.docx`, `.txt`, `.mp3`, `.mp4`) automatically queued and ingested by background workers.
* **Taste Profile & Evidence-Backed Memory**: The system builds and refines an understanding of the author's aesthetic voice and stylistic rules through concrete textual evidence.

---

## 🚀 Quick Start & Deployment

### Method 1: Docker Compose (Recommended)

Verso includes a multi-container Compose stack: PostgreSQL 17 (with `pgvector`), the web application, and the background worker queue.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/verso.git
   cd verso
   ```

2. **Configure environment secrets**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your API key and model identifiers:
   ```env
   VERSO_OPENAI_BASE_URL=https://api.deepseek.com/v1
   VERSO_OPENAI_API_KEY=sk-your-key-here
   VERSO_REASONING_MODEL=deepseek-chat
   VERSO_FAST_MODEL=deepseek-chat
   ```

3. **Start the stack**:
   ```bash
   docker compose up --build -d
   ```

4. **Open Verso**:
   Navigate to [http://127.0.0.1:4173](http://127.0.0.1:4173) in your browser.

---

### Method 2: Local Native Development

Requires **Node.js 24+** and a running **PostgreSQL 17** instance with `pgvector`.

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure `.env`**:
   Ensure `VERSO_DATABASE_URL` points to your PostgreSQL instance:
   ```env
   VERSO_DATABASE_URL=postgres://verso:verso_dev_secret@127.0.0.1:5432/verso
   VERSO_OPENAI_API_KEY=sk-your-key-here
   ```

3. **Run database migrations**:
   ```bash
   npm run db:migrate
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Start the background worker (in a separate terminal)**:
   ```bash
   npm run worker
   ```

---

## 🔒 Security & Loopback Isolation

* **Strict Server-Side Key Management**: API keys never reach the browser bundle or client runtime.
* **Loopback-Only Guard**: Verso refuses to bind to `0.0.0.0` or public IPs unless explicitly configured via `VERSO_CONTAINER=true` (inside container networks) or `VERSO_ALLOW_REMOTE=true`.
* **Zero Telemetry**: All manuscripts and notes remain entirely on your local machine or self-hosted server.

---

## 💾 Operations: Backup & Restore

Consistent atomic backups of the database and media assets can be created and restored at any time:

* **Create a backup**:
  ```bash
  npx tsx scripts/backup.ts
  ```
* **Restore from backup**:
  ```bash
  npx tsx scripts/restore.ts <path-to-backup-dir>
  ```

---

## 📄 License

MIT License © 2026 Verso Authors.
