import mammoth from "mammoth";
import { calculateEditorStats, extractPlainText } from "../../shared/manuscript";

export interface ParsedFileResult {
  title: string;
  content: string;
  wordCount: number;
  rawText: string;
}

/**
 * Clean and normalize HTML produced by Mammoth or rich text into clean literary HTML.
 * Preserves paragraphs, headings, blockquotes, bold, italic.
 * Removes all inline styles, classes, fonts, colors, and extraneous attributes.
 */
export function sanitizeMammothHtml(rawHtml: string): string {
  if (!rawHtml) return "";

  // In browser environment, use DOMParser to clean up nodes
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    // Remove any script, style, meta, link tags
    const removableTags = doc.querySelectorAll("script, style, meta, link, object, embed, iframe");
    removableTags.forEach((el) => el.remove());

    // Clean all attributes from allowed tags
    const allElements = doc.body.querySelectorAll("*");
    allElements.forEach((el) => {
      while (el.attributes.length > 0) {
        el.removeAttribute(el.attributes[0].name);
      }
    });

    return doc.body.innerHTML.trim();
  }

  // Fallback regex sanitizer if DOMParser is not available (e.g. non-browser / node testing)
  return rawHtml
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(\w+)(\s+[^>]*)?>/g, "<$1>")
    .trim();
}

/**
 * Parses a client-uploaded file (.txt, .md, or .docx).
 */
export async function parseUploadedFile(file: File): Promise<ParsedFileResult> {
  const fileName = file.name;
  const cleanTitle = fileName.replace(/\.[^/.]+$/, "").trim() || "未命名文稿";
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".doc") && !lowerName.endsWith(".docx")) {
    throw new Error(
      `检测到旧版 Word 格式《${fileName}》。Verso 仅支持现代 .docx 格式。请在 Microsoft Word 或 WPS 中将该文件另存为 .docx 格式后再行导入。`
    );
  }

  let textContent = "";

  if (lowerName.endsWith(".docx")) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const sanitized = sanitizeMammothHtml(result.value);
      textContent = extractPlainText(sanitized);
    } catch (err: any) {
      console.error("Error parsing docx file with mammoth:", err);
      throw new Error(
        `无法解析 Word 文档《${fileName}》。请确保是标准的 .docx 格式。错误信息: ${err?.message || "未知错误"}`
      );
    }
  } else if (lowerName.endsWith(".txt") || lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) {
    textContent = await file.text();
  } else {
    // Fallback: attempt plain text read
    textContent = await file.text();
  }

  const cleanContent = textContent.trim();
  const stats = calculateEditorStats(cleanContent);
  const wordCount = stats.chineseCharacters + stats.totalWords;

  return {
    title: cleanTitle,
    content: cleanContent,
    rawText: cleanContent,
    wordCount,
  };
}

