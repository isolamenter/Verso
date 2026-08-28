import { describe, it, expect } from "vitest";
import { sanitizeMammothHtml, parseUploadedFile } from "../../app/utils/fileImporter";

describe("fileImporter Utility", () => {
  it("sanitizes HTML by stripping styles, scripts, and non-semantic attributes", () => {
    const rawHtml = `
      <style>.test { color: red; }</style>
      <p style="font-size: 14pt; color: #333;" class="MsoNormal">
        <strong>第一章</strong> 暮色降临了。
      </p>
      <script>alert("test")</script>
      <blockquote><span style="font-family: Arial;">“走吧。”他说。</span></blockquote>
    `;

    const sanitized = sanitizeMammothHtml(rawHtml);
    expect(sanitized).not.toContain("<style");
    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain('style="');
    expect(sanitized).not.toContain('class="');
    expect(sanitized).toContain("<strong>第一章</strong>");
    expect(sanitized).toContain("暮色降临了。");
    expect(sanitized).toContain("<blockquote>");
  });

  it("parses .txt File correctly", async () => {
    const file = new File(["这是纯文本正文内容。\n第二段落。"], "夜行货车.txt", {
      type: "text/plain",
    });

    const result = await parseUploadedFile(file);
    expect(result.title).toBe("夜行货车");
    expect(result.content).toContain("这是纯文本正文内容。\n第二段落。");
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it("parses .md File correctly", async () => {
    const file = new File(["# 第一章\n\n雨水顺着屋檐滴落。"], "第七天.md", {
      type: "text/markdown",
    });

    const result = await parseUploadedFile(file);
    expect(result.title).toBe("第七天");
    expect(result.content).toContain("雨水顺着屋檐滴落。");
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it("rejects legacy binary .doc format with a clear guidance error", async () => {
    const file = new File(["dummy binary doc content"], "老稿件.doc", {
      type: "application/msword",
    });

    await expect(parseUploadedFile(file)).rejects.toThrow("检测到旧版 Word 格式");
  });
});

