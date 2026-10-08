import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import {
  extractPlainText,
  isTipTapDocJson,
  plainTextToTipTapDoc,
} from "../../../shared/manuscript";
import type { TipTapNode } from "../../../shared/manuscript";
import type { Manuscript, Scene } from "../../../shared/schemas/project";

function runs(node: TipTapNode): TextRun[] {
  if (node.type === "hardBreak") return [new TextRun({ break: 1 })];
  if (node.type === "text")
    return [
      new TextRun({
        text: node.text || "",
        bold: node.marks?.some((m) => m.type === "bold"),
        italics: node.marks?.some((m) => m.type === "italic"),
        strike: node.marks?.some((m) => m.type === "strike"),
      }),
    ];
  return (node.content || []).flatMap(runs);
}
function paragraphs(node: TipTapNode): Paragraph[] {
  if (["paragraph", "heading"].includes(node.type))
    return [
      new Paragraph({
        children: runs(node),
        heading:
          node.type === "heading"
            ? Number(node.attrs?.level) === 1
              ? HeadingLevel.HEADING_1
              : HeadingLevel.HEADING_2
            : undefined,
        spacing: { after: 160, line: 360 },
      }),
    ];
  if (node.type === "blockquote")
    return (node.content || []).flatMap(paragraphs);
  if (node.type === "bulletList" || node.type === "orderedList")
    return (node.content || []).map(
      (item, index) =>
        new Paragraph({
          children: [
            new TextRun({
              text: node.type === "orderedList" ? `${index + 1}. ` : "• ",
            }),
            ...runs(item),
          ],
          spacing: { after: 120 },
        }),
    );
  return (node.content || []).flatMap(paragraphs);
}
export async function exportCleanDocx(
  title: string,
  manuscripts: Array<Manuscript & { scenes: Scene[] }>,
) {
  const children = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
  ];
  for (const manuscript of manuscripts) {
    if (manuscripts.length > 1)
      children.push(
        new Paragraph({
          text: manuscript.title,
          heading: HeadingLevel.HEADING_1,
        }),
      );
    for (const scene of manuscript.scenes.filter((s) => !s.metadata.planned)) {
      if (!extractPlainText(scene.content).trim()) continue;
      children.push(
        new Paragraph({ text: scene.title, heading: HeadingLevel.HEADING_2 }),
      );
      const doc = isTipTapDocJson(scene.content)
        ? JSON.parse(scene.content)
        : plainTextToTipTapDoc(extractPlainText(scene.content));
      children.push(...paragraphs(doc));
    }
  }
  return Packer.toBuffer(
    new Document({
      title,
      creator: "Verso",
      styles: {
        default: {
          document: {
            run: { font: "宋体", size: 24 },
            paragraph: { spacing: { line: 360 } },
          },
        },
      },
      sections: [{ children }],
    }),
  );
}
