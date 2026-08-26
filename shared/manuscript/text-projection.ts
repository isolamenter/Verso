import type { TipTapDoc, TipTapNode, PlainTextSegment, EditorStats } from "./types";

export function isTipTapDocJson(content: string | object | null | undefined): boolean {
  if (!content) return false;
  if (typeof content === "object") {
    const obj = content as any;
    return obj.type === "doc" && Array.isArray(obj.content);
  }
  if (typeof content !== "string") return false;
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return Boolean(parsed && parsed.type === "doc" && Array.isArray(parsed.content));
  } catch {
    return false;
  }
}

export function isHtmlString(content: string | null | undefined): boolean {
  if (!content || typeof content !== "string") return false;
  const trimmed = content.trim();
  return /<(p|h[1-6]|blockquote|ul|ol|li|strong|em|b|i|br|div|span)[\s>]/i.test(trimmed);
}

export function extractPlainText(content: string | object | null | undefined): string {
  if (!content) return "";
  let docObj: any = null;

  if (typeof content === "object") {
    docObj = content;
  } else if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && parsed.type === "doc" && Array.isArray(parsed.content)) {
          docObj = parsed;
        } else {
          return content;
        }
      } catch {
        return content;
      }
    } else if (isHtmlString(content)) {
      return content
        .replace(/<\/(p|h[1-6]|blockquote|li|div)>/gi, "\n\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    } else {
      return content;
    }
  }

  if (!docObj || docObj.type !== "doc" || !Array.isArray(docObj.content)) {
    return typeof content === "string" ? content : "";
  }

  function nodeToText(node: any): string {
    if (!node) return "";
    if (node.type === "text") {
      return node.text || "";
    }
    if (node.type === "hardBreak") {
      return "\n";
    }
    if (Array.isArray(node.content)) {
      if (node.type === "paragraph" || node.type === "heading" || node.type === "blockquote") {
        return node.content.map(nodeToText).join("");
      }
      if (node.type === "bulletList" || node.type === "orderedList") {
        return node.content.map(nodeToText).join("\n");
      }
      if (node.type === "listItem") {
        return node.content.map(nodeToText).join("\n");
      }
      return node.content.map(nodeToText).join("");
    }
    return "";
  }

  const blocks: string[] = [];
  for (const block of docObj.content) {
    const text = nodeToText(block);
    if (text.length > 0 || block.type === "paragraph") {
      blocks.push(text);
    }
  }

  return blocks.join("\n\n");
}

export function plainTextToTipTapDoc(plainText: string): TipTapDoc {
  if (!plainText || !plainText.trim()) {
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    };
  }

  const paragraphs = plainText.split(/\n\n+/);
  const content: TipTapNode[] = paragraphs.map((para) => {
    const lines = para.split("\n");
    const paraContent: TipTapNode[] = [];
    lines.forEach((line, idx) => {
      if (line) {
        paraContent.push({
          type: "text",
          text: line,
        });
      }
      if (idx < lines.length - 1) {
        paraContent.push({
          type: "hardBreak",
        });
      }
    });

    return {
      type: "paragraph",
      content: paraContent.length > 0 ? paraContent : undefined,
    };
  });

  return {
    type: "doc",
    content,
  };
}

export function buildPlainTextOffsetMap(content: string | object | null | undefined): PlainTextSegment[] {
  if (!content) return [];
  let docObj: any = null;
  if (typeof content === "object") {
    docObj = content;
  } else if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && parsed.type === "doc" && Array.isArray(parsed.content)) {
          docObj = parsed;
        }
      } catch {}
    }
  }

  const segments: PlainTextSegment[] = [];
  let currentPlainOffset = 0;

  if (!docObj || docObj.type !== "doc" || !Array.isArray(docObj.content)) {
    const plain = typeof content === "string" ? content : "";
    if (plain) {
      segments.push({
        plainStart: 0,
        plainEnd: plain.length,
        type: "text",
        text: plain,
      });
    }
    return segments;
  }

  const validBlocks = docObj.content.filter(
    (block: any) => block && (block.type === "paragraph" || (block.content && block.content.length > 0))
  );

  function traverseNode(
    node: any,
    parent: any,
    idxInParent: number,
    blockNode: any,
    blockIdx: number
  ) {
    if (!node) return;
    if (node.type === "text") {
      const text = node.text || "";
      if (text.length > 0) {
        segments.push({
          plainStart: currentPlainOffset,
          plainEnd: currentPlainOffset + text.length,
          type: "text",
          text,
          node,
          parentNode: parent,
          indexInParent: idxInParent,
          blockNode,
          blockIndex: blockIdx,
        });
        currentPlainOffset += text.length;
      }
    } else if (node.type === "hardBreak") {
      segments.push({
        plainStart: currentPlainOffset,
        plainEnd: currentPlainOffset + 1,
        type: "hardBreak",
        text: "\n",
        node,
        parentNode: parent,
        indexInParent: idxInParent,
        blockNode,
        blockIndex: blockIdx,
      });
      currentPlainOffset += 1;
    } else if (Array.isArray(node.content)) {
      node.content.forEach((child: any, cIdx: number) => {
        traverseNode(child, node, cIdx, blockNode, blockIdx);
      });
    }
  }

  validBlocks.forEach((block: any, bIdx: number) => {
    if (bIdx > 0) {
      segments.push({
        plainStart: currentPlainOffset,
        plainEnd: currentPlainOffset + 2,
        type: "separator",
        text: "\n\n",
        blockIndex: bIdx,
      });
      currentPlainOffset += 2;
    }

    if (Array.isArray(block.content)) {
      block.content.forEach((child: any, cIdx: number) => {
        traverseNode(child, block, cIdx, block, bIdx);
      });
    }
  });

  return segments;
}

export function calculateEditorStats(content: string): EditorStats {
  const plainText = extractPlainText(content);
  if (!plainText) {
    return {
      chineseCharacters: 0,
      totalWords: 0,
      paragraphs: 0,
      readingTimeMinutes: 0,
    };
  }

  const chineseMatches = plainText.match(/[\u4e00-\u9fa5\u3400-\u4dbf]/g);
  const chineseCount = chineseMatches ? chineseMatches.length : 0;

  const nonChineseWords = plainText
    .replace(/[\u4e00-\u9fa5\u3400-\u4dbf]/g, " ")
    .replace(/[^\w\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const totalWords = chineseCount + nonChineseWords;

  const paragraphs = plainText
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean).length;

  const readingTimeMinutes = Math.max(1, Math.ceil(totalWords / 350));

  return {
    chineseCharacters: chineseCount,
    totalWords,
    paragraphs,
    readingTimeMinutes,
  };
}

