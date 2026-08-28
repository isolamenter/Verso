# Verso — 严肃文学创作与审读工作台 (v1.0)

<div align="center">

**[English](./README.md)** | **简体中文**

<br/>

*“字句如止水，待匠心雕琢。”*

**Verso** 是一款专为纯文学、中短篇小说、散文、诗歌及深度非虚构写作者打造的 **Agent-First** 智能文学审读工作台与创作空间。

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?style=flat-square)](https://react.dev/)
[![React Router](https://img.shields.io/badge/React_Router-8.3-red.svg?style=flat-square)](https://reactrouter.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17_pgvector-336791.svg?style=flat-square)](https://github.com/pgvector/pgvector)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg?style=flat-square)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-amber.svg?style=flat-square)](./LICENSE)

</div>

---

## 📖 核心理念与审美防线

不同于常见的网络小说套路续写或流水线式生成工具，Verso 坚守极其克制的严肃文学编辑原则：

1. **创作者主体性（Author First）**：AI 绝不直接篡改原作正文，文稿手卷始终是唯一的“事实来源（Source of Truth）”。AI 作为高敏锐度文学审读者，仅以“非破坏性改稿案卷（Change Sets）”形式提出带上下文锚点的修改提案，供创作者逐条审阅。
2. **诊断重于生成（Critique Before Generation）**：摒弃廉价迎合的夸赞（如“文笔优美”、“情节引人入胜”），优先提供客观的文学机理剖析（视角漂移、叙述距离、语势断连、概念抢跑），再给出微创手术式的修订单。
3. **减法法则（Subtractive Editing）**：文学的力量常来自删削与留白。AI 重点诊断作者越位解释、概念先行、过早命名情绪、无效修饰词与套话陈词。
4. **文学取舍得失小结（Trade-off Deliberation）**：任何改动皆有代价。AI 不武断宣称改动绝对更好，而是客观拆解收益（如：增强含蓄、提升冷峻感）与代价（如：削弱戏剧张力、增加读者解读负担）。
5. **服务端受控安全与私有边界**：模型密钥与服务商端点统一由服务端环境（`.env`）管理，绝不暴露给浏览器前端；默认强制仅监听本机回环地址（`127.0.0.1:4173`），作品文稿绝不上传任何第三方未授权服务器。

---

## 🏗️ 整体技术架构

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                          Verso 前端交互层 (React 19)                       │
│  ┌───────────────────────┬──────────────────────┬──────────────────────┐  │
│  │ 书稿手卷 (双栏只读/手编)│ 创作素材谱系 (知识图谱)│ 审读编撰助手 (Agent)  │  │
│  └───────────────────────┴──────────────────────┴──────────────────────┘  │
│                     ▲ 改稿案卷 (Change Sets) 差异比对与锚点合并              │
├─────────────────────┼─────────────────────────────────────────────────────┤
│                     ▼ SSE 流式长连接 (Server-Sent Events) & REST API        │
│                          Verso 核心服务端 (Express)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Agent 运行时 • 智能上下文引擎 (Context Engine) • 真实证据回执         │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ 领域服务层：作品项目、手稿卷场、改稿单、素材谱系、技能系统 (Skills)    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────────────────────────┤
│                          异步任务队列 (PgBoss)                             │
│  后台任务处理：多媒体素材解析、全文切片、语义向量化 (pgvector)             │
├───────────────────────────────────────────────────────────────────────────┤
│                          数据存储与模型网关                               │
│  PostgreSQL 17 (pgvector) • 本地内容寻址媒体文件存储                      │
│  服务端 OpenAI 兼容协议网关 (支持 DeepSeek、OpenAI、OpenRouter、Ollama 等)│
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 核心功能特性

* **双模态书稿工作台**：支持“沉浸只读审阅”与“手动落笔修改”无缝切换，提供精确的中文字数统计与阅读时长预估。
* **持久化文学助手与上下文证据回执（Context Receipts）**：对话式审读助手完全知晓人物小传、世界设定与历史讨论，所有发往模型的上下文均提供清晰的 Token 预算占比与引用来源。
* **带锚点的原子化改稿案卷（Change Sets）**：AI 提出的文字改动自带前后置定位锚点，支持差异对比（Diff）、一键原子化采纳、逐条拒绝或手动微调，绝不破坏原有富文本排版。
* **层级化创作素材谱系（Knowledge Lineage）**：结构化管理人物、道具、历史年表、世界法则与参考资料，支持混合检索（语义向量 + 全文关键词）。
* **多媒体素材异步摄取**：支持上传 `.docx`、`.txt`、音视频访谈录音，由后台 Worker 自动排队解析并沉淀为可被 Agent 调用的创作素材。
* **品味记忆与风格画像（Taste Profile）**：基于真实文本证据持续记录作者的语感偏好、词汇禁忌与句式习惯，保持长期创作风格连贯。

---

## 🚀 快速上手与部署

### 方式一：Docker Compose 一键部署（推荐）

项目内置了包含 PostgreSQL 17（带 `pgvector`）、Web 服务与后台 Worker 的完整容器集群。

1. **克隆代码库**：
   ```bash
   git clone https://github.com/your-org/verso.git
   cd verso
   ```

2. **配置服务端环境变量**：
   ```bash
   cp .env.example .env
   ```
   用文本编辑器打开 `.env`，填入您的模型服务商 API Key。例如使用 DeepSeek：
   ```env
   VERSO_OPENAI_BASE_URL=https://api.deepseek.com/v1
   VERSO_OPENAI_API_KEY=sk-your-deepseek-key-here
   VERSO_REASONING_MODEL=deepseek-chat
   VERSO_FAST_MODEL=deepseek-chat
   ```

3. **启动容器集群**：
   ```bash
   docker compose up --build -d
   ```

4. **访问工作台**：
   打开浏览器访问 [http://127.0.0.1:4173](http://127.0.0.1:4173) 即可开始创作。

---

### 方式二：本机源码直接运行

需本地安装 **Node.js 24+** 并拥有一个启用了 `pgvector` 扩展的 **PostgreSQL 17** 实例。

1. **安装依赖**：
   ```bash
   npm install
   ```

2. **配置环境变量**：
   配置 `.env` 文件，确保 `VERSO_DATABASE_URL` 指向本地数据库：
   ```env
   VERSO_DATABASE_URL=postgres://verso:verso_dev_secret@127.0.0.1:5432/verso
   VERSO_OPENAI_API_KEY=sk-your-api-key-here
   ```

3. **执行数据库结构初始化与迁移**：
   ```bash
   npm run db:migrate
   ```

4. **启动前端与 Web 服务**：
   ```bash
   npm run dev
   ```

5. **启动后台任务处理队列（另开终端窗口）**：
   ```bash
   npm run worker
   ```

---

## 🔒 隐私与回环网络安全

* **服务端唯一凭据存储**：API Key 仅存放于服务器 `.env` 中，前端 JavaScript 无论如何探测均无法获取任何凭证。
* **本机回环防线（Loopback Guard）**：单用户模式下服务默认拒绝绑定非回环地址（如 `0.0.0.0` 或局域网 IP），避免公共网络或局域网意外暴露。
* **数据完全私有自主**：全部小说手卷、人物小传与设定案卷均保存在您本地的 PostgreSQL 数据库与磁盘中。

---

## 💾 运维：备份与恢复

系统内置原子化备份与还原机制，一键导出全部文稿、设定与多媒体附件校验包：

* **创建完整备份**：
  ```bash
  npx tsx scripts/backup.ts
  ```
* **从备份包恢复**：
  ```bash
  npx tsx scripts/restore.ts <备份目录路径>
  ```

---

## 📄 开源协议

MIT License © 2026 Verso Authors.
