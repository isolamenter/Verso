import { useState, useRef, useEffect } from "react";
import { useI18n } from "../../i18n";
import type { SkillDiscoveryItem } from "../../../server/skills/skill-runtime";

export interface SkillSelectorProps {
  skills: SkillDiscoveryItem[];
  selectedSkillId?: string;
  onSelectSkill: (skillId: string | undefined) => void;
  disabled?: boolean;
}

export function SkillSelector({
  skills,
  selectedSkillId,
  onSelectSkill,
  disabled = false,
}: SkillSelectorProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSkill = skills.find((s) => s.id === selectedSkillId);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const categories = [
    { id: "all", label: t("skills.categoryAll") },
    { id: "critique", label: t("skills.categoryCritique") },
    { id: "creation", label: t("skills.categoryCreation") },
    { id: "analysis", label: t("skills.categoryAnalysis") },
    { id: "revision", label: t("skills.categoryRevision") },
  ];

  const filteredSkills =
    activeCategory === "all"
      ? skills
      : skills.filter((s) => s.category === activeCategory);

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "critique":
        return t("skills.categoryCritique");
      case "creation":
        return t("skills.categoryCreation");
      case "analysis":
        return t("skills.categoryAnalysis");
      case "revision":
        return t("skills.categoryRevision");
      default:
        return category;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-serif transition-all border cursor-pointer ${
          isOpen
            ? "border-cinnabar bg-cinnabar/5 text-ink shadow-xs"
            : selectedSkillId
            ? "border-cinnabar/40 bg-paper-raise text-ink hover:border-cinnabar"
            : "border-ink-muted/20 bg-paper-raise/60 text-ink-muted hover:text-ink hover:border-ink-muted/40"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={t("skills.selectSkill")}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            selectedSkillId ? "bg-cinnabar" : "bg-ink-faint"
          }`}
        />
        <span className="truncate max-w-[130px] font-medium">
          {activeSkill ? activeSkill.name : t("skills.defaultSkill")}
        </span>
        <svg
          className={`w-3 h-3 text-ink-muted group-hover:text-ink transition-transform duration-200 ${
            isOpen ? "rotate-180 text-cinnabar" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-1.5 w-84 sm:w-96 rounded-md bg-paper border border-line-strong shadow-xl z-50 overflow-hidden font-serif animate-fade-in text-ink"
          style={{ maxHeight: "calc(100vh - 120px)" }}
        >
          {/* Header */}
          <div className="px-3.5 py-2.5 border-b border-line bg-paper-raise flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-ink flex items-center space-x-1.5">
                <span>{t("skills.libraryTitle")}</span>
                <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-ink-muted/10 text-ink-muted">
                  {skills.length + 1} 视角
                </span>
              </h3>
              <p className="text-[11px] text-ink-muted mt-0.5">
                {t("skills.activeSkill")}
              </p>
            </div>
            {selectedSkillId && (
              <button
                type="button"
                onClick={() => {
                  onSelectSkill(undefined);
                  setIsOpen(false);
                }}
                className="text-[11px] text-cinnabar hover:underline cursor-pointer"
              >
                重置为通用
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="px-3 py-1.5 border-b border-line/60 bg-paper flex items-center space-x-1 overflow-x-auto text-[11px] no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
                  activeCategory === cat.id
                    ? "bg-ink text-paper font-medium"
                    : "text-ink-muted hover:text-ink hover:bg-paper-sunken"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Skill List Body */}
          <div className="overflow-y-auto max-h-[380px] p-2 space-y-1.5 divide-y divide-line/40">
            {/* Default Skill Option (shown under 'all' or 'critique') */}
            {(activeCategory === "all" || activeCategory === "critique") && (
              <div
                onClick={() => {
                  onSelectSkill(undefined);
                  setIsOpen(false);
                }}
                className={`p-2.5 rounded transition-all cursor-pointer border ${
                  !selectedSkillId
                    ? "bg-paper-raise border-cinnabar/40 shadow-xs"
                    : "bg-paper hover:bg-paper-raise border-transparent hover:border-line"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-semibold text-ink">
                      {t("skills.defaultSkill")}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-ink-muted/10 text-ink-muted">
                      默认通用
                    </span>
                  </div>
                  {!selectedSkillId && (
                    <span className="text-cinnabar text-xs font-bold">✓</span>
                  )}
                </div>
                <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
                  {t("skills.defaultSkillDesc")}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="inline-flex items-center text-[10px] text-ink-muted bg-paper-sunken px-1.5 py-0.5 rounded">
                    ⚖️ 全面兼顾
                  </span>
                  <span className="inline-flex items-center text-[10px] text-ink-muted bg-paper-sunken px-1.5 py-0.5 rounded">
                    📚 关联设定与记忆
                  </span>
                </div>
              </div>
            )}

            {/* Configured Built-in Skills */}
            {filteredSkills.map((skill) => {
              const isSelected = selectedSkillId === skill.id;
              const isBlind = skill.contextPolicy?.includeKnowledge === false;
              const hasKnowledge = skill.contextPolicy?.includeKnowledge === true;
              const hasMemory = skill.contextPolicy?.includeMemory === true;

              return (
                <div
                  key={skill.id}
                  onClick={() => {
                    onSelectSkill(skill.id);
                    setIsOpen(false);
                  }}
                  className={`p-2.5 rounded transition-all cursor-pointer border pt-2.5 ${
                    isSelected
                      ? "bg-paper-raise border-cinnabar/40 shadow-xs"
                      : "bg-paper hover:bg-paper-raise border-transparent hover:border-line"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-semibold text-ink">
                        {skill.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-cinnabar/10 text-cinnabar font-medium">
                        {getCategoryLabel(skill.category)}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="text-cinnabar text-xs font-bold">✓</span>
                    )}
                  </div>

                  <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
                    {skill.description}
                  </p>

                  {/* Context Policy & Capabilities Badges */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {isBlind && (
                      <span className="inline-flex items-center text-[10px] text-cinnabar bg-cinnabar-soft px-1.5 py-0.5 rounded font-medium">
                        🚫 {t("skills.badgeBlind")}
                      </span>
                    )}
                    {hasKnowledge && (
                      <span className="inline-flex items-center text-[10px] text-ink-muted bg-paper-sunken px-1.5 py-0.5 rounded">
                        📚 {t("skills.badgeWithKnowledge")}
                      </span>
                    )}
                    {hasMemory && (
                      <span className="inline-flex items-center text-[10px] text-ink-muted bg-paper-sunken px-1.5 py-0.5 rounded">
                        🕊️ {t("skills.badgeWithMemory")}
                      </span>
                    )}
                    {skill.id === "prose_expansion" && (
                      <span className="inline-flex items-center text-[10px] text-ink-muted bg-paper-sunken px-1.5 py-0.5 rounded">
                        🌿 {t("skills.badgeSensory")}
                      </span>
                    )}
                    {skill.supportedTools && skill.supportedTools.length > 0 && (
                      <span className="inline-flex items-center text-[10px] text-ink-faint bg-paper-sunken/60 px-1.5 py-0.5 rounded">
                        ⚙️ {skill.supportedTools.length} 工具链
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="px-3 py-2 border-t border-line/60 bg-paper-raise/70 text-[11px] text-ink-muted flex items-center justify-between">
            <span>选择视角后，下一次提问将即时生效</span>
            <span className="text-[10px] text-ink-faint font-mono">v1.0</span>
          </div>
        </div>
      )}
    </div>
  );
}

