import { describe, it, expect } from 'vitest';
import { buildSceneDraftPrompt } from '../draft';
import { parseSceneDraftResponse } from '../parser';
import type { Manuscript, Scene, SceneDraftParams } from '../../types';

describe('buildSceneDraftPrompt', () => {
  const mockManuscript: Manuscript = {
    id: 'manu-1',
    projectId: 'proj-1',
    title: '暴雨中的修鞋匠',
    genre: 'short_story',
    synopsis: '20世纪80年代末南方沿海小城，老修鞋匠林远在一次拆迁动员中意外发现了一把二十年前的旧钥匙。',
    themeAnalysis: '表面是拆迁与故土消逝，实质是对遗忘与历史罪责的抵抗。',
    notes: '保持第三人称内聚焦，避免直接心理描写。',
    characters: [
      { id: 'c1', name: '林远', role: '主角', notes: '沉默寡言，常有长久的停顿。' },
      { id: 'c2', name: '神秘故人', role: '主要配角', notes: '说话带着北方腔，习惯用反问句。' },
    ],
    motifs: [
      { id: 'm1', name: '生锈的钥匙', description: '象征被封存的记忆与罪恶。' },
      { id: 'm2', name: '连绵的梅雨', description: '烘托压抑与潮湿的叙事基调。' },
    ],
    createdAt: 1000,
    updatedAt: 1000,
  };

  const mockScenes: Scene[] = [
    {
      id: 'sc-1',
      manuscriptId: 'manu-1',
      title: '第一场：钥匙',
      order: 1,
      content: '雨一直下。林远坐在小板凳上，手里捏着那把刚从夹缝里抠出来的生锈钥匙。',
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'sc-2',
      manuscriptId: 'manu-1',
      title: '第二场：借伞的来客',
      order: 2,
      content: '',
      pov: '第三人称内聚焦（林远）',
      location: '修鞋铺檐下',
      timeframe: '傍晚 暴雨',
      createdAt: 1000,
      updatedAt: 1000,
    },
  ];

  it('builds a rich literary drafting prompt with all manuscript and scene outline context', () => {
    const params: SceneDraftParams = {
      mode: 'draft',
      sceneTitle: '第二场：借伞的来客',
      sceneOutline: '林远在修鞋铺收摊，一个穿着雨衣的男人突然站在檐下借伞，两人就二十年前的一场大火展开试探。',
      pov: '第三人称内聚焦（林远）',
      locationAndTime: '傍晚暴雨 修鞋铺檐下',
      targetLength: 'medium',
      userNotes: '重点突出两人在雨声中的沉默与停顿，不要过早挑明身份。',
      lensInstruction: '【克制与减法透镜】：严查情绪命名，增加动作物性细节。',
    };

    const prompt = buildSceneDraftPrompt({
      params,
      manuscript: mockManuscript,
      scenes: mockScenes,
      currentScene: mockScenes[1],
    });

    expect(prompt).toContain('你是一位极具语言质感、叙事沉浸感与审美克制力的纯文学');
    expect(prompt).toContain('全书故事梗概');
    expect(prompt).toContain('20世纪80年代末南方沿海小城');
    expect(prompt).toContain('深层主题矛盾剖析');
    expect(prompt).toContain('林远 (主角): 沉默寡言');
    expect(prompt).toContain('生锈的钥匙');
    expect(prompt).toContain('前一场景末尾衔接');
    expect(prompt).toContain('雨一直下。林远坐在小板凳上');
    expect(prompt).toContain('本场场景大纲与情节点');
    expect(prompt).toContain('林远在修鞋铺收摊');
    expect(prompt).toContain('篇幅要求：标准场景篇幅，目标篇幅约为 1500 ~ 2500 字');
    expect(prompt).toContain('创作者特别要求：重点突出两人在雨声中的沉默与停顿');
    expect(prompt).toContain('文学透镜指导要求：【克制与减法透镜】');
    expect(prompt).toContain('"content"');
    expect(prompt).toContain('"literaryNotes"');
  });

  it('builds continuation prompt with existing text tail', () => {
    const params: SceneDraftParams = {
      mode: 'continuation',
      sceneTitle: '第二场',
      sceneOutline: '借伞客离开，林远锁门回家。',
      targetLength: 'short',
      existingContent: '男人转过身，雨水顺着雨衣的下摆滴在门槛上。他没有拿伞。',
    };

    const prompt = buildSceneDraftPrompt({
      params,
      manuscript: mockManuscript,
      scenes: mockScenes,
      currentScene: mockScenes[1],
    });

    expect(prompt).toContain('【当前已有正文（请紧密顺接其末尾继续书写）】');
    expect(prompt).toContain('男人转过身，雨水顺着雨衣的下摆滴在门槛上');
    expect(prompt).toContain('精炼短篇片段，目标篇幅约为 800 ~ 1200 字');
    expect(prompt).toContain('无缝顺接上方已有正文的语气');
  });
});

describe('parseSceneDraftResponse', () => {
  it('parses valid JSON scene draft output', () => {
    const raw = JSON.stringify({
      content: '天色黑得比平时早。檐口的积水汇成一股浑浊的细流，砸在石阶上。\n\n林远低头摆弄着手里的拔钉钳，没有抬头。',
      literaryNotes: '本段通过暴雨的物性描写建立冷感，避免直接叙述主角内心的紧张。',
    });

    const parsed = parseSceneDraftResponse(raw);
    expect(parsed.content).toContain('天色黑得比平时早');
    expect(parsed.literaryNotes).toBe('本段通过暴雨的物性描写建立冷感，避免直接叙述主角内心的紧张。');
    expect(parsed.wordCount).toBe(parsed.content.length);
  });

  it('handles markdown fenced JSON response', () => {
    const raw = `\`\`\`json
{
  "content": "门板响了三下。声音很闷，像是用指节内侧扣出来的。",
  "literaryNotes": "使用动作声音细节开篇。"
}
\`\`\``;

    const parsed = parseSceneDraftResponse(raw);
    expect(parsed.content).toBe('门板响了三下。声音很闷，像是用指节内侧扣出来的。');
    expect(parsed.literaryNotes).toBe('使用动作声音细节开篇。');
  });

  it('falls back gracefully to raw prose if non-JSON returned', () => {
    const raw = '这是一段直接返回的小说正文段落。\n\n林远站在门前，看着雨幕中的背影渐渐消失。';
    const parsed = parseSceneDraftResponse(raw);
    expect(parsed.content).toBe(raw);
    expect(parsed.literaryNotes).toBeUndefined();
    expect(parsed.wordCount).toBe(raw.length);
  });

  it('handles empty input', () => {
    const parsed = parseSceneDraftResponse('');
    expect(parsed.content).toBe('');
    expect(parsed.wordCount).toBe(0);
  });
});

