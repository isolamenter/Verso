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
5. **本地优先与绝对隐私 (Zero Server Privacy Guarantee)**：文稿全部保存在浏览器本地 IndexedDB 沙箱中；API Key 仅存于浏览器本地（localStorage / sessionStorage / 内存缓存），由浏览器直连所选服务商，绝不经过任何自有中转服务器。

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
* **细粒度上下文检视 (Context Inspector)**：清晰呈现并允许勾选当前发送给大模型的上下文范围（选区段落、当前场景、前置场景、人物笔记、意象网络、全书稿）。
* **Profile 级上下文策略 (Context Policy)**：每个模型 Profile 还可绑定固定上下文策略 —— `仅选区`、`仅当前场景`、`场景 + 笔记`、`场景 + 前置场景`、`全书稿`，让长文本扫描保持确定性。

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
* **智能会话快照**：连续写作停顿（30 秒）且文本自上次快照后发生变化时，自动生成会话快照。
* **实时连续保存与切换前 Flush**：1.5 秒防抖自动保存 + 场景切换、书稿切换、页面隐藏/关闭时自动执行 `flushAutosave` 强刷落库，确保打字永不丢失。
* **快照分类管理**：支持快照手动里程碑命名、版本对比与一键安全还原。

### 9. 多格式导入与 AI 文学智能建档 (Multi-Format Import & Literary Profiling)
* **多格式纯本地解析**：原生支持 `.txt`、`.md` 以及 `.docx` (Word 文档，基于纯客户端 `mammoth.js` 语义清洗解析，自动去除排版杂质与行内样式，100% 本地沙箱处理，绝不上云)。
* **AI 文学建档与解构助手 (Manuscript Onboarding)**：文学备忘中五个独立模块，每项可单独「AI 生成」（通读全文提取）或「AI 精修」（以当前内容为基线、结合批注修订），不再需要全量重跑：
  * **故事梗概**：自动提炼时空舞台、核心行动线与人际暗流；生成/精修后支持一键撤销 AI 修改。
  * **深层主题剖析**：独立于创作备忘存储，提炼隐秘文学矛盾 (Subtext)，与创作者手写备忘互不干扰。
  * **人物小传与声线特征**：提取登场人物、性格质感、对白声线与潜台词习惯；生成结果勾选后按名合并（大小写不敏感、别名感知去重），精修可合并重复条目并整体替换。
  * **核心意象网络**：提取反复出现的象征物、感官细节与互文频次，同样支持按名去重合并与精修替换。
  * **长文智能分场切分 (Smart Scene Split)**：按时空转换与章节标识全量切分为独立场景，正文逐字一致；应用前展示拼接覆盖率校验与可展开的正文预览，替换现有分场需二次确认；支持多轮「AI 精修」迭代调整切分边界。
  * **用户批注与精准重构 (User Annotations & Regeneration)**：每个模块均可输入创作者批注（人物关系修正、意象偏好、梗概侧重与分场指示），结合快捷标签一键带批注生成或精修。

### 10. 基于大纲的场景起草与故事生成 (Scene Drafting & Story Generation)
* **全要素文学上下文绑定**：自动融合书稿故事梗概、深层主题矛盾、人物小传与声线、核心意象网络、前序场景结尾与当前场景大纲细纲。
* **三大创作模式**：
  * **全新起草整场 (Full Scene Draft)**：从开头落笔，完整铺展场景的时空入景、人际对话、张力发展与收束（支持精炼 ~800字、标准 ~1500字、详实 ~2500字档位）。
  * **承接正文续写 (Continuation)**：紧密顺接已有正文末尾的语气、叙述距离与人物微动作，继续推进下一阶段情节。
  * **骨架细节扩写 (Expansion)**：将提纲要点或选中文段展开为富含感官物性、心理暗流与环境细节的丰满文学段落。
* **纯文学审美防护与文学机理小结**：严禁 AI 俗套词汇与翻译腔，坚持白描物性与对白潜台词；生成后自动输出文学构思说明与得失小结。
* **多阶安全采纳与版本保护**：
  * **流式打字渲染**：实时字数统计与即时打断。
  * **替换当前场景**：自动生成前置防丢快照，写入修订单，随时一键还原。
  * **追加到文末** / **保存为场景备选快照**：无缝归入版本管理，支持在「版本取舍」中双栏比对。

---

## 🔒 BYOK 安全机制与隐私边界

Verso 为纯客户端应用，不架设任何自有服务器，文稿与密钥完全掌控在创作者手中：

* **浏览器沙箱密钥存储**：API Key 运行时缓存于内存，并持久化于浏览器 `localStorage`（读取时含 `sessionStorage` 回退），绝不上传任何服务器；设置中支持一键清除全部本地密钥。
* **浏览器直连服务商**：AI 请求由浏览器直接发往您所选择的模型服务商，Verso 不架设任何中转、代理或遥测服务器。
* **纯本地离线 (Ollama)**：Profile 可指向本地回环端点（`http://localhost:11434` 上的 Ollama 服务，如 Qwen 2.5、本地 DeepSeek 等），提示词与正文完全不离开本机，无需 Key。
* **多 Provider 支持与任务路由**：支持 OpenAI (GPT-4o)、Anthropic (Claude 3.7 Sonnet)、Google Gemini (2.0 Flash / 2.5)、DeepSeek (V3 / R1)、OpenRouter、Ollama 及自定义兼容端点；每个 Profile 可独立配置最大输出 Token（默认 8192）与请求超时（默认 300 秒）；可将不同任务（如冷读者、细修、速览、本地隐私）绑定至不同的模型 Profile。
* **导出脱敏**：导出文稿项目时自动剔除所有密钥配置。

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
│   IndexedDB (Dexie.js)  •  localStorage / sessionStorage    │
└─────────────────────────────────────────────────────────────┘
```

* **Core Framework**: React 19 + TypeScript 6
* **Rich Text Engine**: Tiptap Editor (StarterKit, Highlight, Typography, CharacterCount, Placeholder)
* **Styling**: Tailwind CSS v4 + Lucide Icons
* **Local Database**: Dexie.js (IndexedDB 沙箱存储，带 Autosave Flush)
* **Diff & Splicing Algorithm**: diff-match-patch + 1-to-1 TipTap JSON 树 Range Splicer
* **API Key 存储**: 内存缓存 + localStorage / sessionStorage（浏览器沙箱）
* **Build & Testing**: Vite 8 + Vitest (63 个单元/集成测试，13 个测试套件) + Oxlint

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
