import { describe, it, expect } from "vitest";
import {
  splitManuscriptTextByAnchors,
  computeSplitCoverage,
} from "../../shared/manuscript";

describe("Manuscript Splitter & Coverage Engine", () => {
  const sampleText = `第一章 雨夜的旅人
傍晚时分，窗外的雨落得更急了。他合上书，叹了一口气。街上的车灯连成一条长线，在积水的柏油路上拖拽出金红色的光带。他想起十年前离开这个城市的时候，也是这样的雨天。

第二章 钟楼下的约定
次日清晨，大雨终于止歇。城中心的旧钟楼在晨雾中若隐若现。他在铜钟敲响第七下时抵达了街角的花店。玻璃门上挂着的风铃发出一阵清脆的响声。柜台后站着一位戴银丝眼镜的老人。

第三章 远方的信笺
信是三天后寄到的。牛皮纸信封的边缘已经磨损，邮戳模糊不清。他小心翼翼地用小刀裁开封口，里面只有一张泛黄的便签，上面写着一行简短的地址。`;

  it("splits text gaplessly using monotonically increasing startQuote anchors", () => {
    const splits = [
      {
        title: "第一章 雨夜的旅人",
        summary: "雨夜中的离愁与回忆",
        startQuote: "第一章 雨夜的旅人",
      },
      {
        title: "第二章 钟楼下的约定",
        summary: "清晨在钟楼花店与老人的相遇",
        startQuote: "第二章 钟楼下的约定",
      },
      {
        title: "第三章 远方的信笺",
        summary: "收到神秘来信与简短地址",
        startQuote: "第三章 远方的信笺",
      },
    ];

    const results = splitManuscriptTextByAnchors(sampleText, splits);
    expect(results).toHaveLength(3);

    expect(results[0].title).toBe("第一章 雨夜的旅人");
    expect(results[0].content).toContain("他想起十年前离开这个城市的时候");
    expect(results[0].content).not.toContain("第二章 钟楼下的约定");

    expect(results[1].title).toBe("第二章 钟楼下的约定");
    expect(results[1].content).toContain("柜台后站着一位戴银丝眼镜的老人。");
    expect(results[1].content).not.toContain("第三章 远方的信笺");

    expect(results[2].title).toBe("第三章 远方的信笺");
    expect(results[2].content).toContain("上面写着一行简短的地址。");

    // Verify continuous concatenation matches full text
    const concatenated = results.map((r) => r.content).join("");
    expect(concatenated).toBe(sampleText);

    // Verify 100% coverage
    const coverage = computeSplitCoverage(sampleText, results);
    expect(coverage).toBe(1);
  });

  it("handles fuzzy / prefix anchor fallback when exact match has slight difference", () => {
    const splits = [
      {
        title: "第一场",
        startQuote: "第一章 雨夜的旅人",
      },
      {
        title: "第二场",
        // Slight whitespace/quote difference that requires fallback or prefix match
        startQuote: "次日清晨，大雨终于止歇",
      },
    ];

    const results = splitManuscriptTextByAnchors(sampleText, splits);
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe("第一场");
    expect(results[1].title).toBe("第二场");
    expect(results[1].content.startsWith("次日清晨，大雨终于止歇")).toBe(true);

    const coverage = computeSplitCoverage(sampleText, results);
    expect(coverage).toBe(1);
  });

  it("gracefully falls back to single scene if no subsequent anchors matched", () => {
    const splits = [
      {
        title: "第一场",
        startQuote: "第一章 雨夜的旅人",
      },
      {
        title: "第二场",
        startQuote: "完全不存在于文中的虚构起句",
      },
    ];

    const results = splitManuscriptTextByAnchors(sampleText, splits);
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe(sampleText);
    expect(computeSplitCoverage(sampleText, results)).toBe(1);
  });

  it("handles empty input safely", () => {
    expect(splitManuscriptTextByAnchors("", [])).toEqual([]);
    expect(computeSplitCoverage("", [])).toBe(1);
  });
});

