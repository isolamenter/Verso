import { describe, it, expect } from 'vitest';
import { buildSceneDraftPrompt } from '../prompts/draft';
import { parseSceneDraftResponse } from '../prompts/parser';
import type { Manuscript, Scene, SceneDraftParams, RevisionSnapshot } from '../types';

describe('Scene Drafting & Story Generation Lifecycle', () => {
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
      summary: '神秘人上门借伞，两人就当年的火灾展开试探。',
      createdAt: 1000,
      updatedAt: 1000,
    },
  ];

  it('builds a complete scene drafting prompt with all literary context layers', () => {
    const params: SceneDraftParams = {
      mode: 'draft',
      sceneTitle: '第二场：借伞的来客',
      sceneOutline: '林远在修鞋铺收摊，一个穿着雨衣的男人突然站在檐下借伞，两人就二十年前的一场大火展开试探。',
      pov: '第三人称内聚焦（林远）',
      locationAndTime: '傍晚暴雨 修鞋铺檐下',
      targetLength: 'medium',
      userNotes: '重点突出两人在雨声中的沉默与停顿。',
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
  });

  it('parses drafted prose and literary design rationale', () => {
    const rawOutput = JSON.stringify({
      content: '门外的雨幕像一层厚重的灰布。檐口的积水顺着锈迹斑斑的铁皮往下坠，砸在青石板上，发出沉闷的扑扑声。\n\n林远用拔钉钳撬开最后一只旧鞋掌，没有抬头。',
      literaryNotes: '通过梅雨的触感与劳作微动作切入，避免主观情绪命名。',
    });

    const parsed = parseSceneDraftResponse(rawOutput);
    expect(parsed.content).toContain('门外的雨幕像一层厚重的灰布');
    expect(parsed.literaryNotes).toContain('通过梅雨的触感与劳作微动作切入');
    expect(parsed.wordCount).toBe(parsed.content.length);
  });

  it('safely applies drafted scene with pre-action safety snapshot and revision tracking', () => {
    let currentSceneContent = '这是作者之前写的简短片段草稿。';
    const revisions: RevisionSnapshot[] = [];

    const applyDraftToScene = (newContent: string, mode: 'replace' | 'append') => {
      if (mode === 'replace') {
        if (currentSceneContent.trim()) {
          revisions.push({
            id: `rev-pre-${Date.now()}`,
            sceneId: 'sc-2',
            timestamp: Date.now() - 1,
            description: '采纳 AI 场景起草前自动快照',
            changeType: 'checkpoint',
            content: currentSceneContent,
          });
        }
        currentSceneContent = newContent;
        revisions.push({
          id: `rev-ai-${Date.now()}`,
          sceneId: 'sc-2',
          timestamp: Date.now(),
          description: `采纳 AI 场景起草生成初稿 (~${newContent.length} 字)`,
          changeType: 'ai_accepted',
          content: newContent,
        });
      } else {
        const merged = currentSceneContent ? `${currentSceneContent}\n\n${newContent}` : newContent;
        currentSceneContent = merged;
        revisions.push({
          id: `rev-append-${Date.now()}`,
          sceneId: 'sc-2',
          timestamp: Date.now(),
          description: `追加 AI 续写/扩写内容到场景 (~${newContent.length} 字)`,
          changeType: 'ai_accepted',
          content: merged,
        });
      }
    };

    const draftedStory = '天黑下来了。男人在檐下站定，收拢了黑色的油布雨衣。\n\n“借把伞。”他说。';

    // 1. Replace mode
    applyDraftToScene(draftedStory, 'replace');
    expect(currentSceneContent).toBe(draftedStory);
    expect(revisions.length).toBe(2);
    expect(revisions[0].description).toBe('采纳 AI 场景起草前自动快照');
    expect(revisions[0].content).toBe('这是作者之前写的简短片段草稿。');
    expect(revisions[1].changeType).toBe('ai_accepted');

    // 2. Append mode
    const continuation = '林远抬起头，手里的拔钉钳停在半空。';
    applyDraftToScene(continuation, 'append');
    expect(currentSceneContent).toContain(draftedStory);
    expect(currentSceneContent).toContain(continuation);
    expect(revisions.length).toBe(3);
    expect(revisions[2].description).toContain('追加 AI 续写/扩写内容到场景');
  });

  it('preserves draft alternatives in revisions for version comparison', () => {
    const revisions: RevisionSnapshot[] = [];
    const draftAlt = '另一种视角：男人站在雨中，看着屋里亮着的昏黄灯光。';

    const saveDraftAsRevision = (content: string, desc: string) => {
      revisions.push({
        id: `rev-alt-${Date.now()}`,
        sceneId: 'sc-2',
        timestamp: Date.now(),
        description: desc,
        changeType: 'checkpoint',
        content,
      });
    };

    saveDraftAsRevision(draftAlt, 'AI 场景起草备选方案 B (~26 字)');
    expect(revisions.length).toBe(1);
    expect(revisions[0].description).toBe('AI 场景起草备选方案 B (~26 字)');
    expect(revisions[0].content).toBe(draftAlt);
  });
});

