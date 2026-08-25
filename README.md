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
5. **Zero Server Privacy Guarantee (Local-First)**: Manuscripts reside purely in your browser's IndexedDB sandbox. Your API keys are encrypted via WebCrypto AES-GCM or held in volatile session memory—never touching any third-party server.

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
* **Context Inspector**: Full visibility and granular toggles over what is sent to the LLM (Selected text, Current scene, Preceding scene, Character notes).

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
* **Session Checkpoint Snapshots**: Records automatic revision checkpoints during pauses in writing (30s) when cumulative edits exceed 20 characters.
* **Continuous Autosave with Pre-Switch Flush**: Debounced 1.5s autosave backed by immediate synchronous/asynchronous flushing (`flushAutosave`) before scene switching, manuscript switching, window blur/hide, or tab closing—guaranteeing zero data loss.
* **Snapshot Management**: Milestone tagging, version comparison, and single-click restoration.

---

## 🔒 Security & BYOK Architecture

Verso implements a zero-trust, local-first security architecture:

| Storage Mode | Security Mechanism | Recommended Use Case |
| :--- | :--- | :--- |
| **Session Only** | Keys are held in RAM / SessionStorage (retained across refreshes in the same tab, destroyed upon closing tab/browser or manual clearing). | **Default recommended**, shared workstations or highest security |
| **Encrypted Local** | Encrypted in the browser sandbox using native WebCrypto API (AES-GCM 256-bit with PBKDF2 100k iterations and independent random Salt & IV). | Private devices, eliminates re-entering keys |
| **Local-Only (Offline)** | Cloud traffic is physically blocked; requests route strictly to loopback endpoints (`127.0.0.1` / Ollama). | Confidential drafts & air-gapped environments |

* **Locked Profile Protection**: When an encrypted local profile is locked after reload, the studio explicitly alerts the user to enter their passphrase before invoking AI critique.
* **Multi-Provider Hub**: Native support for OpenAI, Anthropic (Claude 3.7 Sonnet), Google Gemini (2.5 Flash / 2.0), DeepSeek, OpenRouter, Ollama, and custom OpenAI-compatible endpoints.
* **Task-Based Profile Routing**: Bind specific tasks (Cold Reader, Line Edit, Quick Critique, Ask) to specialized model profiles.
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
│    IndexedDB (Dexie.js)   •   WebCrypto (AES-GCM 256)       │
└─────────────────────────────────────────────────────────────┘
```

* **Core Framework**: React 19 + TypeScript 6
* **Rich Text Engine**: Tiptap Editor (StarterKit, Highlight, Typography, CharacterCount)
* **Styling**: Tailwind CSS v4 + Lucide Icons
* **Local Storage**: Dexie.js (IndexedDB browser sandbox with Autosave Flush)
* **Diff & Splicing Engine**: diff-match-patch + 1-to-1 JSON Tree Range Splicer
* **Cryptography**: Native WebCrypto API (AES-GCM 256 + PBKDF2 100k)
* **Build & Test**: Vite 8 + Vitest (43 tests) + Oxlint

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
