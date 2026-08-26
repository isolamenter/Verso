# Verso — AI Literary Editorial Studio & Craft Workbench

<div align="center">

**English** | **[简体中文](./README_zh.md)**

<br/>

*“Words rest like still water, awaiting deliberate craft.”*

**Verso** is a **Local-First** AI literary editorial suite and craft workbench purpose-built for authors of literary fiction, short stories, essays, poetry, and serious non-fiction.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?style=flat-square)](https://react.dev/)
[![Tiptap](https://img.shields.io/badge/Editor-Tiptap-green.svg?style=flat-square)](https://tiptap.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg?style=flat-square)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-amber.svg?style=flat-square)](./LICENSE)

</div>

---

## 📖 Philosophy & Core Principles

Unlike commercial AI ghostwriters or boilerplate web-novel generators, Verso adheres to strictly restrained principles of serious literary editing:

1. **Author First**: AI never ghostwrites long-form passages. The manuscript remains the sole Source of Truth. AI acts strictly as an analytical lens focusing on prose texture, narrative distance, syntactic cadence, and rhetorical flaws.
2. **Critique Before Generation**: Verso eliminates patronizing praise (*“vivid imagery”, “captivating story”*). It provides objective literary diagnostics first, followed by tiered, surgical proposals.
3. **Subtractive Editing**: Great writing is often the art of subtraction. AI identifies authorial over-explanation, exposed thematic concepts, emotion naming, redundant modifiers, and clichés.
4. **Trade-off Analysis**: Every edit has a cost. Rather than claiming a revision is strictly "better", AI breaks down what is gained (e.g., heightened restraint, poetic ambiguity) versus what is sacrificed (e.g., increased reader cognitive load, softened dramatic immediacy).
5. **Zero Server Privacy Guarantee (Local-First)**: Manuscripts reside purely in your browser's IndexedDB sandbox. API keys are kept only in the browser (localStorage / sessionStorage / in-memory) and travel browser-to-provider—never passing through any first-party server.

---

## 🛠️ Key Features

### 1. Selection-First Literary Critique
* **Seven Diagnostic Lenses**:
  * **Comprehensive Critique**: Point of view stability, narrative tension, motivation, and premature emotion naming.
  * **Language & Texture**: Diagnosis of translation-ese, LLM homogeneity, abstract phrasing, hollow ornamentation, and adverb bloat.
  * **Rhythm & Syntax**: Sentence length variation, syntactic breath, punctuation pacing, and monotonous cadence.
  * **Dialogue & Subtext**: Voice differentiation, subtext layers, and detection of characters serving merely as informational mouthpieces.
  * **Subtractive Cut**: Dedicated strictly to finding words, clauses, sentences, or paragraphs that should be removed.
  * **Imagery Network**: Analysis of motif recurrence, sensory distribution, forced symbolism, and over-explained metaphors.
  * **Narrative Distance**: Detection of narrator intrusion, free indirect discourse consistency, and POV drift.
* **Three-Tier Revision Proposals**: Minimal (micro-surgery), Moderate (syntactic restructuring), and Radical (conceptual reimagining).
* **Deterministic Rich Text Range Splice**: Supported by a 1-to-1 character offset map (`buildPlainTextOffsetMap`) connecting plain text coordinates to TipTap JSON tree nodes. AI suggestions spanning bold marks, breaks, or paragraph boundaries are surgically spliced without downgrading the document to plain text or losing surrounding styling.
* **Duplicate Quote Disambiguation & Dynamic Re-anchoring**: AI critique annotations dynamically re-anchor (`findBestAnchorMatch`) when text is added or removed before the quote, correctly pointing to the intended occurrence (e.g. 2nd duplicate sentence) and refusing ambiguous adoptions when identical sentences cannot be uniquely resolved.

### 2. Cold Reader Mode
* **Strict Isolation Guarantee**: Automatically severs access to project notes, character sheets, and authorial intentions to simulate an unbiased first-time reader.
* **Objective Reader Decoding**:
  * **Perceived Facts & Plot**: What the reader actually understood took place.
  * **Power Dynamics & Tension**: Perceived emotional undercurrents and shifting leverage between characters.
  * **Theme Reception**: Resonance and underlying takeaways decoded purely from the text.
  * **Semantic Friction & Author Blind Spots**: Highlights implicit information known only to the author that failed to translate onto the page.

### 3. Intent vs. Text Verification
* State what you intended a passage to convey.
* AI examines the manuscript sentence by sentence for textual evidence, evaluating whether the intention is:
  * `Clearly present`
  * `Partially present`
  * `Not present`
  * `Over-explained`

### 4. Trade-off Compare (Version Deliberation)
* Select two drafts from your snapshot history or paste variations side-by-side.
* Generates nuanced literary trade-off analysis instead of binary verdicts:
  * *“Version A preserves epistemological ambiguity and poetic stillness at the cost of pacing; Version B amplifies dramatic friction while muting the echo with Chapter 1.”*

### 5. Interactive Creative Inquiry (Ask & Discuss)
* Direct literary consultation inside the studio panel (*“Why does this scene feel ungrounded?”*, *“Which line is most dispensable?”*).
* **Context Inspector**: Full visibility and granular toggles over what is sent to the LLM (Selected text, Current scene, Preceding scene, Character notes, Motifs, Entire manuscript).
* **Per-Profile Context Policies**: Each model profile can also enforce a fixed context policy—`Selection Only`, `Current Scene Only`, `Scene & Notes`, `Scene & Preceding`, or `Full Manuscript`—keeping long-context scans deterministic.

### 6. Custom Literary Lenses & Prompt Library
* Built-in classic lenses:
  * **Restraint & Subtraction**: Flags direct emotion naming and authorial commentary.
  * **Contemporary Chinese Idiom**: Filters out translated prose mannerisms and LLM boilerplate.
  * **Sensory Materiality**: Checks for concrete physical texture, temperature, and tactile detail.
  * **Dialogue Voice**: Evaluates authentic vocal grain and subtextual weight.
* Fully customizable: create and save your own aesthetic lenses and prompt templates.

### 7. Distraction-Free Canvas & Fine Typography
* **Typewriter Mode**: Keeps your active line vertically centered on the screen.
* **Focus Mode**: Hide all sidebars and toolbars with `Cmd/Ctrl + Shift + F`.
* **Three Paper Themes**: Parchment, Frost, and Ink.
* **Literary Typefaces**: Fine-tuned rendering for Songti (Serif), Kaiti, Sans-serif, and Monospace.
* **In-Scene Find & Replace**: Lightweight search bar triggered by `Cmd/Ctrl + F`.

### 8. Atomic Revisions & Zero-Loss Snapshots
* **Pre-Restore Safety Snapshot**: Automatically creates a backup snapshot before rolling back to any historical version, ensuring spontaneous ideas are never lost.
* **Session Checkpoint Snapshots**: Records automatic revision checkpoints during pauses in writing (30s) whenever the text has changed since the last checkpoint.
* **Continuous Autosave with Pre-Switch Flush**: Debounced 1.5s autosave backed by immediate synchronous/asynchronous flushing (`flushAutosave`) before scene switching, manuscript switching, window blur/hide, or tab closing—guaranteeing zero data loss.
* **Snapshot Management**: Milestone tagging, version comparison, and single-click restoration.

### 9. Multi-Format Import & AI Literary Profiling
* **Fully Local Parsing**: Native support for `.txt`, `.md`, and `.docx` (Word documents are semantically cleaned client-side via `mammoth.js`, stripping layout noise and inline styles—100% in-browser, never uploaded).
* **AI Manuscript Onboarding** — five independent modules inside the literary memo, each runnable on its own via **AI Generate** (full-manuscript extraction) or **AI Refine** (revise the current value with your annotations) instead of re-running everything:
  * **Synopsis**: Distills the story's stage, spine of action, and interpersonal undercurrents, with one-click undo of AI edits.
  * **Deep Theme Analysis**: Stored separately from your handwritten notes, surfaces the hidden literary conflict (subtext) without polluting your memo.
  * **Character Bios & Voice Profiling**: Extracts named characters, temperament textures, dialogue voice, and subtext habits; generated items merge by name (case-insensitive, alias-aware dedupe), refine merges duplicates and replaces the list.
  * **Motif Network Mining**: Surfaces recurring symbols, sensory details, and intertextual frequencies, with the same dedupe-aware merge/replace semantics.
  * **Smart Scene Split**: Long-form manuscripts are split into scenes by temporal/spatial shifts and chapter markers, verbatim to the source; coverage check and expandable full-text preview before applying, confirmation required to replace existing scenes, and multi-round refine to iterate on boundaries.
  * **User Annotations & Regeneration**: Every module accepts creator annotations (character-relation corrections, motif preferences, synopsis emphasis, scene-split instructions) with quick-insert tags for generate or refine.

---

## 🔒 Security & BYOK Architecture

Verso is a pure client-side application with no server of its own. Manuscripts and keys never touch any Verso infrastructure:

* **Browser-Sandboxed Keys**: API keys are cached in memory at runtime and persisted in the browser's `localStorage` (with a `sessionStorage` fallback on read)—never uploaded anywhere, and removable anytime via one-click clearing in Settings.
* **Direct Provider Calls**: AI requests travel browser-to-provider only. Verso operates no relay, proxy, or telemetry server.
* **Local-Only via Ollama**: Profiles can point at loopback endpoints (`http://localhost:11434`—Ollama, Qwen 2.5, local DeepSeek, …)—prompts and text never leave the machine, and no key is required.
* **Multi-Provider Hub**: Native support for OpenAI (GPT-4o), Anthropic (Claude 3.7 Sonnet), Google Gemini (2.0 Flash / 2.5), DeepSeek (V3 / R1), OpenRouter, Ollama, and custom OpenAI-compatible endpoints. Max output tokens (default 8192) and request timeout (default 300s) are configurable per profile.
* **Task-Based Profile Routing**: Bind specific tasks (Cold Reader, Line Edit, Quick Critique, Ask, Local Privacy) to specialized model profiles.
* **Sanitized Exports**: Project and manuscript export routines automatically strip all stored API keys.

---

## ⌨️ Keyboard Shortcuts

| Shortcut (Mac / Win) | Action |
| :--- | :--- |
| `Cmd / Ctrl + F` | In-Scene Find & Replace |
| `Cmd / Ctrl + Shift + F` | Toggle Zen Focus Mode |
| `Cmd / Ctrl + B` | Toggle Manuscript Sidebar |
| `Cmd / Ctrl + J` | Toggle Editorial Studio |
| `Cmd / Ctrl + S` | Create Manual Checkpoint Snapshot |

---

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                       Verso UI Layer                        │
│   ┌───────────────┬──────────────────────┬──────────────┐   │
│   │ Sidebar       │ Tiptap Canvas        │ Studio       │   │
│   │ (Manuscripts) │ (Selection / Diff)   │ (Lenses/Ask) │   │
│   └───────────────┴──────────────────────┴──────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Application State Layer                  │
│       useManuscript  •  useCritique  •  useRevision         │
├─────────────────────────────────────────────────────────────┤
│                Literary Engine & Prompts                    │
│   Cold Reader • Intent Check • 7 Lenses • Diff Patching     │
│       Offset Map  •  Anchor Matcher  •  JSON Splicer        │
├─────────────────────────────────────────────────────────────┤
│                  BYOK Multi-Provider Hub                    │
│   OpenAI • Claude • Gemini • Ollama • DeepSeek • OpenRouter │
├─────────────────────────────────────────────────────────────┤
│                     Local Storage Layer                     │
│   IndexedDB (Dexie.js)  •  localStorage / sessionStorage    │
└─────────────────────────────────────────────────────────────┘
```

* **Core Framework**: React 19 + TypeScript 6
* **Rich Text Engine**: Tiptap Editor (StarterKit, Highlight, Typography, CharacterCount, Placeholder)
* **Styling**: Tailwind CSS v4 + Lucide Icons
* **Local Storage**: Dexie.js (IndexedDB browser sandbox with Autosave Flush)
* **Diff & Splicing Engine**: diff-match-patch + 1-to-1 JSON Tree Range Splicer
* **API Key Storage**: In-memory cache + localStorage / sessionStorage (browser sandbox)
* **Build & Test**: Vite 8 + Vitest (63 tests across 13 suites) + Oxlint

---

## 🚀 Quick Start & Local Development

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/verso.git
cd verso
npm install
```

### 2. Start Development Server

```bash
npm run dev
```
Open `http://localhost:5173` in your browser. Click the Settings icon in the header to enter your API Key or connect to a local Ollama instance to start writing.

### 3. Run Test Suite

```bash
npm test
```

### 4. Linting & Production Build

```bash
npm run lint
npm run build
```

---

## 📄 License

This project is open source under the [MIT License](./LICENSE). Contributions and discussions on the future of AI-assisted literary craftsmanship are warmly welcomed.
