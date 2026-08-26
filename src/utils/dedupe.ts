/**
 * Name-based entity dedupe utilities for characters / motifs (AI 建档模块).
 *
 * Matching is case-insensitive on trimmed names. With `matchAlias: true`,
 * an item is treated as a duplicate when its name or alias collides with a
 * kept item's name or alias — aliases must be >= 2 characters so
 * single-character placeholders (她 / 叔) don't cause false positives.
 */

export interface NameAliasItem {
  name: string;
  alias?: string;
}

function register(item: NameAliasItem, seen: Set<string>, matchAlias: boolean): void {
  const name = (item.name || '').trim().toLowerCase();
  if (name) seen.add(name);
  if (matchAlias) {
    const alias = (item.alias || '').trim().toLowerCase();
    if (alias.length >= 2) seen.add(alias);
  }
}

function collides(item: NameAliasItem, seen: Set<string>, matchAlias: boolean): boolean {
  const name = (item.name || '').trim().toLowerCase();
  if (seen.has(name)) return true;
  if (matchAlias) {
    const alias = (item.alias || '').trim().toLowerCase();
    if (alias.length >= 2 && seen.has(alias)) return true;
  }
  return false;
}

/**
 * 批内去重：大小写不敏感、保留首条。空 name 条目被丢弃。
 */
export function dedupeByName<T extends NameAliasItem>(
  items: T[],
  options?: { matchAlias?: boolean }
): T[] {
  const matchAlias = Boolean(options?.matchAlias);
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const item of items) {
    const name = (item.name || '').trim().toLowerCase();
    if (!name) continue;
    if (collides(item, seen, matchAlias)) continue;
    register(item, seen, matchAlias);
    kept.push(item);
  }
  return kept;
}

/**
 * 合并（生成语义）：incoming 先批内去重，再过滤掉与 existing 同名（或别名冲突）的条目，
 * 返回 [...existing, ...新增]。existing 本身不被修改（不动历史数据）。
 */
export function mergeByName<T extends NameAliasItem>(
  existing: T[],
  incoming: T[],
  options?: { matchAlias?: boolean }
): T[] {
  const matchAlias = Boolean(options?.matchAlias);
  const fresh = dedupeByName(incoming, options);
  const seen = new Set<string>();
  for (const item of existing) {
    register(item, seen, matchAlias);
  }
  const additions = fresh.filter((item) => !collides(item, seen, matchAlias));
  return [...existing, ...additions];
}
