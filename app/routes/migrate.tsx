import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { DryRunResult, ImportExecutionResult } from "../../server/domain/import/legacy-import-service";

export default function MigrateRoute() {
  const navigate = useNavigate();
  const [dryRunData, setDryRunData] = useState<DryRunResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInspectLocalData = async () => {
    setError(null);
    try {
      // Read legacy localStorage keys if available in browser
      const rawBooks = localStorage.getItem("verso_books");
      const rawCharacters = localStorage.getItem("verso_characters");
      const rawWorldRules = localStorage.getItem("verso_world_rules");

      const books = rawBooks ? JSON.parse(rawBooks) : [];
      const characters = rawCharacters ? JSON.parse(rawCharacters) : [];
      const worldRules = rawWorldRules ? JSON.parse(rawWorldRules) : [];

      const payload = {
        projectTitle: books[0]?.title ? `${books[0].title} (迁移项目)` : "旧版书稿迁移项目",
        manuscripts: books.map((b: any) => ({
          title: b.title || "未命名书稿",
          description: b.description || "",
          scenes: (b.scenes || []).map((s: any, idx: number) => ({
            title: s.title || `第 ${idx + 1} 场`,
            content: s.content || "",
            summary: s.summary || "",
            pov: s.pov || "",
            order: idx,
          })),
        })),
        notes: [
          ...characters.map((c: any) => ({
            title: c.name || "未命名人物",
            content: `【人物小传】\n${c.bio || ""}\n【性格特质】\n${c.traits || ""}`,
            category: "character",
          })),
          ...worldRules.map((w: any) => ({
            title: w.title || "未命名设定",
            content: w.content || "",
            category: "world_rule",
          })),
        ],
      };

      const res = await fetch("/api/import/legacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "dry_run", payload }),
      });

      const json = await res.json();
      if (json.success) {
        setDryRunData(json.result);
      } else {
        setError(json.error || "预检失败");
      }
    } catch (err: any) {
      setError(err.message || "未能读取本地旧版数据");
    }
  };

  const handleExecuteImport = async () => {
    if (!dryRunData) return;
    setIsImporting(true);
    setError(null);

    try {
      const rawBooks = localStorage.getItem("verso_books");
      const rawCharacters = localStorage.getItem("verso_characters");
      const rawWorldRules = localStorage.getItem("verso_world_rules");

      const books = rawBooks ? JSON.parse(rawBooks) : [];
      const characters = rawCharacters ? JSON.parse(rawCharacters) : [];
      const worldRules = rawWorldRules ? JSON.parse(rawWorldRules) : [];

      const payload = {
        projectTitle: dryRunData.projectTitle,
        manuscripts: books.map((b: any) => ({
          title: b.title || "未命名书稿",
          description: b.description || "",
          scenes: (b.scenes || []).map((s: any, idx: number) => ({
            title: s.title || `第 ${idx + 1} 场`,
            content: s.content || "",
            summary: s.summary || "",
            pov: s.pov || "",
            order: idx,
          })),
        })),
        notes: [
          ...characters.map((c: any) => ({
            title: c.name || "未命名人物",
            content: `【人物小传】\n${c.bio || ""}\n【性格特质】\n${c.traits || ""}`,
            category: "character",
          })),
          ...worldRules.map((w: any) => ({
            title: w.title || "未命名设定",
            content: w.content || "",
            category: "world_rule",
          })),
        ],
      };

      const res = await fetch("/api/import/legacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "execute", payload }),
      });

      const json = await res.json();
      if (json.success) {
        setImportResult(json.result);
      } else {
        setError(json.error || "导入失败");
      }
    } catch (err: any) {
      setError(err.message || "导入执行异常");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-serif">
      <header className="border-b border-ink-muted/15 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link to="/" className="text-xl font-bold font-serif text-cinnabar">
            Verso
          </Link>
          <span className="text-xs text-ink-muted">/</span>
          <span className="text-xs font-medium text-ink">旧版数据迁移工具 (Migration Cutover)</span>
        </div>
        <Link
          to="/"
          className="text-xs text-ink-muted hover:text-ink transition-colors"
        >
          返回工作台
        </Link>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full p-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-ink mb-2">本地浏览器数据迁移</h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            将存储在当前浏览器 IndexedDB / LocalStorage 中的旧版书稿、场景、角色设定与世界观规则，无损迁移至新的 PostgreSQL 架构中。
          </p>
        </div>

        {error && (
          <div className="p-4 bg-cinnabar/10 border border-cinnabar/30 rounded-lg text-cinnabar text-xs">
            {error}
          </div>
        )}

        {importResult ? (
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-4">
            <div className="flex items-center space-x-2 text-emerald-700 font-semibold text-sm">
              <span>✓</span>
              <span>数据迁移已成功完成！</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs text-ink">
              <div className="bg-paper p-3 rounded border border-ink-muted/10">
                <div className="text-ink-muted text-[10px]">导入书稿数</div>
                <div className="text-base font-bold">{importResult.manuscriptIds.length}</div>
              </div>
              <div className="bg-paper p-3 rounded border border-ink-muted/10">
                <div className="text-ink-muted text-[10px]">导入场景数</div>
                <div className="text-base font-bold">{importResult.sceneCount}</div>
              </div>
              <div className="bg-paper p-3 rounded border border-ink-muted/10">
                <div className="text-ink-muted text-[10px]">知识库节点</div>
                <div className="text-base font-bold">{importResult.knowledgeCount}</div>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => navigate(`/projects/${importResult.projectId}`)}
                className="px-4 py-2 bg-ink text-paper rounded text-xs font-medium hover:bg-ink/90 shadow-xs"
              >
                立即前往新项目工作台 →
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {!dryRunData ? (
              <div className="p-6 bg-paper-light border border-ink-muted/20 rounded-lg text-center space-y-4">
                <div className="text-3xl">📦</div>
                <div className="text-xs text-ink-muted max-w-md mx-auto leading-relaxed">
                  点击下方按钮，系统将安全扫描当前浏览器内保存的历史创作数据并生成迁移预览，不会修改或删除现有数据。
                </div>
                <button
                  onClick={handleInspectLocalData}
                  className="px-4 py-2 bg-ink text-paper rounded text-xs font-medium hover:bg-ink/90 shadow-xs transition-colors"
                >
                  扫描并预览旧版数据
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-5 bg-paper border border-ink-muted/20 rounded-lg shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-ink-muted/10 pb-3">
                    <h3 className="text-sm font-semibold text-ink">{dryRunData.projectTitle}</h3>
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-700 px-2 py-0.5 rounded font-medium">
                      校验通过
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div className="bg-paper-light p-2.5 rounded">
                      <span className="text-ink-muted text-[10px] block">书稿本数</span>
                      <span className="font-bold text-ink">{dryRunData.manuscriptCount}</span>
                    </div>
                    <div className="bg-paper-light p-2.5 rounded">
                      <span className="text-ink-muted text-[10px] block">场景总数</span>
                      <span className="font-bold text-ink">{dryRunData.sceneCount}</span>
                    </div>
                    <div className="bg-paper-light p-2.5 rounded">
                      <span className="text-ink-muted text-[10px] block">知识设定</span>
                      <span className="font-bold text-ink">{dryRunData.noteCount}</span>
                    </div>
                    <div className="bg-paper-light p-2.5 rounded">
                      <span className="text-ink-muted text-[10px] block">正文字数</span>
                      <span className="font-bold text-ink">{dryRunData.totalWordCount}</span>
                    </div>
                  </div>

                  {dryRunData.warnings.length > 0 && (
                    <div className="space-y-1 pt-2">
                      {dryRunData.warnings.map((w, idx) => (
                        <div key={idx} className="text-[11px] text-amber-700 bg-amber-500/10 p-2 rounded">
                          ℹ️ {w}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setDryRunData(null)}
                    className="px-3 py-1.5 border border-ink-muted/20 rounded text-xs text-ink-muted hover:text-ink"
                  >
                    重新扫描
                  </button>

                  <button
                    onClick={handleExecuteImport}
                    disabled={isImporting}
                    className="px-5 py-2 bg-ink text-paper rounded text-xs font-medium hover:bg-ink/90 shadow-xs transition-colors"
                  >
                    {isImporting ? "正在安全迁移入库..." : "确认并一键迁移入库 →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
