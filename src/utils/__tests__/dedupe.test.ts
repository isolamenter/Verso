import { describe, it, expect } from 'vitest';
import { dedupeByName, mergeByName } from '../dedupe';
import type { CharacterItem, MotifItem } from '../../types';

const char = (name: string, alias?: string): CharacterItem => ({
  id: `char-${name}`,
  name,
  alias,
  role: '主角',
  notes: '',
});

const motif = (name: string): MotifItem => ({
  id: `motif-${name}`,
  name,
  description: '',
});

describe('dedupeByName', () => {
  it('保留首条并过滤同名重复', () => {
    const result = dedupeByName([char('陈老九'), char('陈老九'), char('林远')]);
    expect(result.map((c) => c.name)).toEqual(['陈老九', '林远']);
  });

  it('大小写不敏感', () => {
    const result = dedupeByName([motif('Rain'), motif('rain'), motif('RAIN')]);
    expect(result).toHaveLength(1);
  });

  it('丢弃空 name 条目', () => {
    const result = dedupeByName([char(''), char('  '), char('林远')]);
    expect(result.map((c) => c.name)).toEqual(['林远']);
  });

  it('matchAlias: name 命中已保留条目的 alias 视为重复', () => {
    const result = dedupeByName(
      [char('陈老九', '九叔'), char('九叔'), char('林远')],
      { matchAlias: true }
    );
    expect(result.map((c) => c.name)).toEqual(['陈老九', '林远']);
  });

  it('matchAlias: 双向命中（后到条目 alias 命中先到 name）', () => {
    const result = dedupeByName(
      [char('九叔'), char('陈老九', '九叔')],
      { matchAlias: true }
    );
    expect(result.map((c) => c.name)).toEqual(['九叔']);
  });

  it('matchAlias: 单字别名不参与匹配', () => {
    const result = dedupeByName([char('她'), char('林远', '她')], { matchAlias: true });
    expect(result.map((c) => c.name)).toEqual(['她', '林远']);
  });

  it('默认不启用 alias 匹配', () => {
    const result = dedupeByName([char('陈老九', '九叔'), char('九叔')]);
    expect(result).toHaveLength(2);
  });
});

describe('mergeByName', () => {
  it('只追加新条目，保持 existing 在前且不被修改', () => {
    const existing = [char('林远'), char('阿香')];
    const result = mergeByName(existing, [char('陈老九'), char('林远')]);
    expect(result.map((c) => c.name)).toEqual(['林远', '阿香', '陈老九']);
    expect(existing.map((c) => c.name)).toEqual(['林远', '阿香']);
  });

  it('incoming 批内先去重', () => {
    const result = mergeByName([], [char('陈老九'), char('陈老九')]);
    expect(result).toHaveLength(1);
  });

  it('alias 冲突被过滤（existing 别名挡住 incoming name）', () => {
    const existing = [char('陈老九', '九叔')];
    const result = mergeByName(existing, [char('九叔'), char('林远')], { matchAlias: true });
    expect(result.map((c) => c.name)).toEqual(['陈老九', '林远']);
  });

  it('existing 中已有的历史重复不被清理', () => {
    const existing = [char('阿香'), char('阿香')];
    const result = mergeByName(existing, [char('陈老九')]);
    expect(result).toHaveLength(3);
  });
});
