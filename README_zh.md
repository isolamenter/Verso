# Verso — 严肃文学与纯文学 AI 编辑工作台

<div align="center">

**[English](./README.md)** | **[简体中文](./README_zh.md)**

<br/>

*“文字如积水，静候推敲。”*

**Verso** 是一款专为纯文学、短篇小说、严肃虚构与非虚构作家打造的 **本地优先 (Local-First)** AI 文学编辑室与写作工作台。

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?style=flat-square)](https://react.dev/)
[![Tiptap](https://img.shields.io/badge/Editor-Tiptap-green.svg?style=flat-square)](https://tiptap.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg?style=flat-square)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-amber.svg?style=flat-square)](./LICENSE)

</div>

---

## 📖 产品美学与核心理念

不同于传统的商业 AI 续写或网文套路生成工具，Verso 秉持极度克制的严肃文学编辑原则：

1. **创作者完全主导 (Author First)**：AI 绝不做长篇代笔，正文始终是唯一事实源 (Source of Truth)。AI 专注于字句肌理、叙述距离、句法呼吸与修辞病灶的精确诊断。
2. **审读先于生成 (Critique Before Generation)**：拒绝“描写生动”、“文笔优美”等无意义的廉价吹捧，以客观的文学机理剖析得失，先诊断病灶、再给阶梯修改建议。
3. **极简减法剪裁 (Subtractive Editing)**：写作是做减法的艺术。AI 敏锐识别作者越俎代庖的情绪命名、概念暴露、冗余副词与陈词滥调，给出删削建议。
4. **文学得失取舍 (Trade-off Analysis)**：任何文本修改皆有代价。AI 明确指出修改后获得了什么（如增加留白与冷感），同时牺牲了什么（如增加认知负荷或降低戏剧冲突）。
5. **本地优先与绝对隐私 (Zero Server Privacy Guarantee)**：文稿全部保存在浏览器本地 IndexedDB 沙箱中；API Key 经由 WebCrypto AES-GCM 加密或仅存于当前会话内存，绝不上传自有服务器。

---

## 🛠️ 核心功能模块

### 1. 选区针对性文学审读 (Selection-First Critique)
* **七大文学显微镜维度**：
  * **综合审读 (Critique)**：叙述视角、张力流动、人物动机与情绪命名剖析。
  * **语言质感 (Language)**：排查翻译腔、AI 味、抽象词堆砌、空洞修辞与修辞过满。
  * **句法节奏 (Rhythm)**：分析长短句交错、韵律停顿、标点呼吸与机械化重复结构。
  * **对白潜台词 (Dialogue)**：审视人物声线辨识度、潜台词深度及是否沦为作者信息工具人。
  * **减法删削 (Cut)**：专注于“删”，找出可剔除的冗余词、半句、整句或段落。
  * **意象网络 (Imagery)**：检查意象重复度、感官分布、象征生硬度与过度解释。
  * **叙述距离 (Distance)**：监控叙述者介入 (Narrator Intrusion)、自由间接引语与视点漂移。
* **三阶修改方案**：Minimal（微创手术）、Moderate（句式重整）、Radical（重构构思）。
* **确证性富文本 Range Splice 采纳**：基于纯文本与 TipTap JSON 树叶子节点的 1-to-1 映射表 (`buildPlainTextOffsetMap`)。支持跨粗体、跨行、跨段落分界的修改安全采纳，严禁将整篇文档降级为纯文本，确保前后章节的标题、粗体、引用等格式 100% 完整保留。
* **重复文本动态 Re-anchor 与歧义防误改**：正文编辑后自动动态重新锚定批注 (`findBestAnchorMatch`)，精准保留指向第二处重复句的锚点；在文本存在多处相同句子且无明确范围时拒绝自动采纳，防止误改其他段落。

### 2. 冷读者盲审模式 (Cold Reader)
* **严格零背景隔离 (Strict Isolation Guarantee)**：自动物理切断所有项目备忘、作者设定、人物小传与创作意图，模拟完全陌生的首次读者。
* **客观解码检验**：
  * **事实感知与情节发生**：读者实际读到了什么。
  * **人物权力与张力流动**：读者感知到的人际暗流。
  * **主题接收**：读者接收到的深层意涵。
  * **阅读阻滞点与作者独占盲区**：指出哪些信息似乎只有作者自己脑中知道，而未落实于字面。

### 3. 意图 vs 文本传达检验 (Intent vs. Text)
* 输入创作者希望传达的深层意图或未言之意。
* AI 逐句检索文本中的客观支撑证据，给出定性判断：
  * `Clearly present`（充分呈现）
  * `Partially present`（部分呈现）
  * `Not present`（未能传达）
  * `Over-explained`（过度解释 / 概念外露）

### 4. 版本推敲与文学得失 (Trade-off Compare)
* 支持从场景版本历史快照中直接调取，或在画布中手动对比两个修改方案。
* 不做扁平的“版本 B 更好”裁决，而是深度剖析双方的文学得失：
  * *“版本 A 保留了认识论层面的暧昧与诗意留白，但叙述节奏稍缓；版本 B 强化了戏剧对抗，却削弱了前后的意象互文。”*

### 5. 自由文学问答与创作讨论 (Ask & Inquire)
* 右侧编辑室提供自由讨论面板，可针对具体字句进行深度文学探讨（如 *“为什么这一段显得悬浮？”*、*“哪一句最应该删？”*）。
* **细粒度上下文检视 (Context Inspector)**：清晰呈现并允许勾选当前发送给大模型的上下文范围（选区段落、当前场景、前置场景、人物笔记）。

### 6. 文学透镜库 (Literary Lenses) 与提示词库 (Prompt Library)
* 内置经典文学透镜：
  * **克制与减法**：严查情绪直接命名与概念自我暴露，优先提出删削。
  * **现代汉语语感**：剔除欧化翻译腔与 LLM 式光滑假大空语料。
  * **南方物性**：检验环境描写是否依赖具体物质、声音与触觉，而非抽象形容词。
  * **对白声线**：审视对白是否具备性格质感与潜台词。
* 支持用户自定义新增与修改透镜，打造专属美学诊断工具。

### 7. 纯净专注画布与古典纸张排版 (Zen Canvas)
* **打字机居中滚动 (Typewriter Mode)**：光标始终锁定在屏幕黄金视线高度。
* **纯净专注模式 (Focus Mode)**：一键隐藏所有侧边栏与工具栏，沉浸于文字。
* **三大素雅纸张主题**：羊皮纸 (Parchment)、霜白 (Frost)、水墨 (Ink)。
* **文学字族排版**：精调宋体 (Serif)、楷体 (Kaiti)、黑体 (Sans) 与等宽体 (Mono)。
* **场景内即时查找替换**：快捷键 `Cmd/Ctrl + F` 呼出轻量查找替换栏。

### 8. 原子化快照与防丢版本管理 (Manuscript Revisions)
* **恢复前自动备份快照 (Pre-restore Safety Snapshot)**：在回滚至任意历史版本前，系统自动生成“恢复前临时快照”，确保当前未保存的即兴灵感永不丢失。
* **智能会话快照**：连续写作停顿（30秒）且编辑字数变动 ≥ 20 字时，自动生成会话快照。
* **实时连续保存与切换前 Flush**：1.5 秒防抖自动保存 + 场景切换、书稿切换、页面隐藏/关闭时自动执行 `flushAutosave` 强刷落库，确保打字永不丢失。
* **快照分类管理**：支持快照手动里程碑命名、版本对比与一键安全还原。

### 9. 多格式导入与 AI 文学智能建档 (Multi-Format Import & Literary Profiling)
* **多格式纯本地解析**：原生支持 `.txt`、`.md` 以及 `.docx` (Word 文档，基于纯客户端 `mammoth.js` 语义清洗解析，自动去除排版杂质与行内样式，100% 本地沙箱处理，绝不上云)。
* **AI 文学建档与解构助手 (Manuscript Onboarding)**：
  * **故事梗概与深层矛盾提炼**：自动提炼时空舞台、核心行动线与隐秘文学矛盾 (Subtext)。
  * **人物小传与声线特征提取**：自动提取登场人物、性格质感、对白声线与潜台词习惯，一键写入文学备忘。
  * **核心意象网络挖掘**：自动提取文本中反复出现的象征物、感官细节与互文频次。
  * **长文智能分场切分 (Smart Scene Split)**：长篇小说自动按时空转换与章节标识拆分为独立场景大纲。
  * **用户批注与精准重构 (User Annotations & Regeneration)**：支持在初次建档前或查看结果后输入创作者批注（如人物关系修正、核心意象偏好、梗概侧重与分场指示），结合快捷标签一键带批注重新生成，让建档结果完全符合创作者意图。
  * **非侵入与创作者自决**：创作者自由勾选、按需修改预览，一键写入本地数据库。

---

## 🔒 BYOK 安全机制与隐私边界

Verso 采用严格的本地隐私架构，让创作者完全掌控自己的文稿与密钥：

| 存储模式 | 安全机制与说明 | 适用场景 |
| :--- | :--- | :--- |
| **仅会话保存 (Session Only)** | 凭证保存于当前内存与 SessionStorage（同标签页刷新保留，关闭标签页/浏览器或手动清理后彻底销毁）。 | **默认推荐**，公共电脑或高安全需求 |
| **本地加密持久化 (Encrypted)** | 采用浏览器原生 WebCrypto API (AES-GCM 256 位，PBKDF2 10 万次迭代 + 独立随机 Salt/IV) 加密存储于浏览器本地沙箱。 | 个人私有电脑，免除重复配置 |
| **纯本地离线模式 (Local-only)** | 物理切断所有云端端点连接，仅允许连接本地回环端点 (`localhost` / `127.0.0.1` 上的 Ollama 服务)。 | 绝密文稿创作与无网环境 |

* **锁定 Profile 明确提示**：当本地加密密钥处于锁定状态时，编辑室会明确提示输入主口令解锁后使用。
* **多 Provider 支持与任务路由**：支持 OpenAI、Anthropic (Claude 3.7 Sonnet)、Google Gemini (2.5 Flash / 2.0)、DeepSeek、OpenRouter、Ollama 及自定义兼容端点；可将不同任务（如冷读者、细修、速览）绑定至不同的模型 Profile。
* **一键清除与导出脱敏**：设置中支持一键清除所有本地凭证；导出文稿项目时自动剔除所有密钥配置。

---

## ⌨️ 常用快捷键

| 快捷键 (Mac / Win) | 功能说明 |
| :--- | :--- |
| `Cmd / Ctrl + F` | 呼出场景内查找与替换栏 (Find & Replace) |
| `Cmd / Ctrl + Shift + F` | 开启 / 退出纯净专注模式 (Focus Mode) |
| `Cmd / Ctrl + B` | 展开 / 折叠左侧文稿大纲栏 (Sidebar) |
| `Cmd / Ctrl + J` | 展开 / 折叠右侧文学编辑室 (Studio) |
| `Cmd / Ctrl + S` | 手动保存当前文稿里程碑快照 (Checkpoint) |

---

## 🏗️ 技术架构

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
* **Local Database**: Dexie.js (IndexedDB 沙箱存储，带 Autosave Flush)
* **Diff & Splicing Algorithm**: diff-match-patch + 1-to-1 TipTap JSON 树 Range Splicer
* **Cryptography**: Native WebCrypto API (AES-GCM 256 位 + PBKDF2 10 万次迭代)
* **Build & Testing**: Vite 8 + Vitest (43 个单元/集成测试) + Oxlint

---

## 🚀 本地开发与快速上手

### 1. 克隆与安装依赖

```bash
git clone https://github.com/your-username/verso.git
cd verso
npm install
```

### 2. 启动本地开发服务

```bash
npm run dev
```
打开浏览器访问 `http://localhost:5173`。点击顶部导航栏的设置图标，配置您的 API Key 或连接本地 Ollama 服务即可开始写作与审读。

### 3. 运行单元测试

```bash
npm test
```

### 4. 代码质量检查与生产构建

```bash
npm run lint
npm run build
```

---

## 📄 开源许可证

本项目采用 [MIT 许可证](./LICENSE)。欢迎文学创作者与开发者共同探索严肃写作与 AI 协作的边界。
