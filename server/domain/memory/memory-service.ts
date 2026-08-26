import { memoryRepository } from "../index";
import type {
  TasteEntry,
  TasteEntryEvidence,
  MemoryScope,
  EvidenceSourceType,
  MemoryLayer,
  MemoryEntry,
} from "../../../shared/schemas/memory";

export interface RecordTasteInput {
  scope?: MemoryScope;
  scopeId?: string;
  projectId?: string;
  dimension: string;
  preference: string;
  conditions?: string[];
  antiPreferences?: string[];
  confidence?: number;
  sourceType: EvidenceSourceType;
  sourceId?: string;
  quote?: string;
}

export interface ScopedMemoriesResult {
  memories: MemoryEntry[];
  tastes: TasteEntry[];
}

export class MemoryService {
  /**
   * Records evidence-backed Taste from durable signals (e.g. ChangeSet review decisions, knowledge corrections).
   * Prevents learning from isolated clicks; handles contradiction through contested/superseded state transitions.
   */
  public async recordTasteEvidence(input: RecordTasteInput): Promise<{
    taste: TasteEntry;
    evidence: TasteEntryEvidence;
    isNew: boolean;
  }> {
    const scope = input.scope ?? "workspace";
    const scopeId = input.scopeId ?? (scope === "project" ? input.projectId : null);

    // 1. Check existing active taste entries in this dimension and scope
    const existingEntries = await memoryRepository.listTasteEntries(scope, scopeId);
    const existing = existingEntries.find((t) => t.dimension === input.dimension && t.status !== "disabled");

    let taste: TasteEntry;
    let isNew = false;

    if (existing) {
      // Check if contradictory or same preference
      const isContradictory =
        existing.preference.toLowerCase() !== input.preference.toLowerCase() &&
        (input.antiPreferences?.includes(existing.preference) ||
          existing.antiPreferences?.includes(input.preference));

      if (isContradictory) {
        // Contradiction detected: mark existing as contested or supersede
        await memoryRepository.updateTasteEntry(existing.id, {
          status: "contested",
        });

        // Create new superseded entry with conditions
        taste = await memoryRepository.createTasteEntry({
          scope,
          scopeId: scopeId ?? undefined,
          dimension: input.dimension,
          preference: input.preference,
          conditions: input.conditions ?? [],
          antiPreferences: input.antiPreferences ?? [],
          confidence: input.confidence ?? 0.6,
          status: "active",
          explicitness: input.sourceType === "explicit_statement" ? "explicit" : "inferred",
          supersedesId: existing.id,
        });
        isNew = true;
      } else {
        // Reinforcing evidence: increase confidence and update timestamp
        const newConfidence = Math.min(1.0, (existing.confidence || 0.5) + 0.1);
        taste = await memoryRepository.updateTasteEntry(existing.id, {
          confidence: newConfidence,
          conditions: Array.from(new Set([...(existing.conditions || []), ...(input.conditions || [])])),
        });
      }
    } else {
      // Create new taste entry backed by this initial durable evidence
      taste = await memoryRepository.createTasteEntry({
        scope,
        scopeId: scopeId ?? undefined,
        dimension: input.dimension,
        preference: input.preference,
        conditions: input.conditions ?? [],
        antiPreferences: input.antiPreferences ?? [],
        confidence: input.confidence ?? 0.5,
        status: "active",
        explicitness: input.sourceType === "explicit_statement" ? "explicit" : "inferred",
      });
      isNew = true;
    }

    // 2. Persist immutable evidence record
    const evidence = await memoryRepository.createTasteEvidence({
      tasteEntryId: taste.id,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      quote: input.quote,
      weight: input.sourceType === "explicit_statement" ? 2.0 : 1.0,
    });

    return { taste, evidence, isNew };
  }

  /**
   * Forgets or disables a taste entry with inspectable boundaries.
   */
  public async forgetTaste(tasteId: string, hardDelete = false): Promise<boolean> {
    if (hardDelete) {
      return await memoryRepository.deleteTasteEntry(tasteId);
    }
    await memoryRepository.updateTasteEntry(tasteId, { status: "disabled" });
    return true;
  }

  /**
   * Retrieves scoped memories and taste entries, respecting layer permissions (e.g. cold reader policy).
   */
  public async getScopedMemories(options: {
    projectId: string;
    allowedLayers?: MemoryLayer[];
    includeTaste?: boolean;
  }): Promise<ScopedMemoriesResult> {
    const { projectId, allowedLayers, includeTaste = true } = options;

    const projectMemories = await memoryRepository.listMemoryEntriesByProject(projectId);
    const workspaceMemories = await memoryRepository.listMemoryEntries("workspace");

    let allMemories = [...projectMemories, ...workspaceMemories];
    if (allowedLayers && allowedLayers.length > 0) {
      allMemories = allMemories.filter((m) => allowedLayers.includes(m.layer));
    }

    let tastes: TasteEntry[] = [];
    if (includeTaste) {
      const projectTastes = await memoryRepository.listTasteEntries("project", projectId);
      const workspaceTastes = await memoryRepository.listTasteEntries("workspace");
      tastes = [...projectTastes, ...workspaceTastes].filter((t) => t.status === "active");
    }

    return {
      memories: allMemories,
      tastes,
    };
  }
}

export const memoryService = new MemoryService();

