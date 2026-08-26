import type { TipTapDoc, PatchOperation, PatchResult } from "./types";
import { extractPlainText, buildPlainTextOffsetMap, plainTextToTipTapDoc } from "./text-projection";
import { findBestAnchorMatch, computeTextChecksum } from "./anchoring";

/**
 * Applies a text patch to a TipTap document safely, preserving unchanged node marks,
 * formatting, and document structure.
 */
export function applyPlainTextPatchToTipTapDoc(
  docInput: TipTapDoc | string,
  patch: PatchOperation
): PatchResult {
  let docObj: TipTapDoc;

  if (typeof docInput === "string") {
    const trimmed = docInput.trim();
    if (trimmed.startsWith("{")) {
      try {
        docObj = JSON.parse(trimmed);
      } catch (err: any) {
        return {
          success: false,
          newDoc: plainTextToTipTapDoc(docInput),
          newDocJson: docInput,
          newPlainText: docInput,
          error: `Failed to parse document JSON: ${err.message}`,
        };
      }
    } else {
      docObj = plainTextToTipTapDoc(docInput);
    }
  } else {
    docObj = structuredClone(docInput);
  }

  if (!docObj || docObj.type !== "doc" || !Array.isArray(docObj.content)) {
    return {
      success: false,
      newDoc: docObj,
      newDocJson: JSON.stringify(docObj),
      newPlainText: "",
      error: "Invalid TipTap document structure",
    };
  }

  const plainText = extractPlainText(docObj);

  // Check originalChecksum if provided
  if (patch.originalChecksum) {
    const currentChecksum = computeTextChecksum(plainText);
    if (currentChecksum !== patch.originalChecksum) {
      return {
        success: false,
        newDoc: docObj,
        newDocJson: JSON.stringify(docObj),
        newPlainText: plainText,
        isStale: true,
        error: `Checksum mismatch: base document modified (expected ${patch.originalChecksum}, got ${currentChecksum})`,
      };
    }
  }

  const targetQuote = patch.quote ?? "";
  const match = findBestAnchorMatch({
    plainText,
    quote: targetQuote,
    prefixAnchor: patch.prefixAnchor,
    suffixAnchor: patch.suffixAnchor,
    rangeHint: patch.rangeFrom !== undefined && patch.rangeTo !== undefined
      ? { from: patch.rangeFrom, to: patch.rangeTo }
      : undefined,
  });

  if (!match.found) {
    return {
      success: false,
      newDoc: docObj,
      newDocJson: JSON.stringify(docObj),
      newPlainText: plainText,
      isStale: match.isStale,
      isAmbiguous: match.isAmbiguous,
      error: match.isAmbiguous
        ? "Ambiguous target quote: multiple matches found without distinguishing anchor context"
        : "Stale target quote: text not found in current scene content",
    };
  }

  const targetFrom = match.range.from;
  const targetTo = match.range.to;
  const newText = patch.replacementContent;

  const segments = buildPlainTextOffsetMap(docObj);
  const overlapSegments = segments.filter(
    (seg) => Math.max(seg.plainStart, targetFrom) < Math.min(seg.plainEnd, targetTo)
  );

  if (overlapSegments.length === 0) {
    // If quote was empty (insertion at position)
    if (targetFrom === targetTo) {
      // Find segment containing targetFrom or insert at beginning
      const seg = segments.find((s) => s.plainStart <= targetFrom && targetFrom <= s.plainEnd && s.type === "text");
      if (seg && seg.node) {
        const orig = seg.node.text || "";
        const offset = targetFrom - seg.plainStart;
        seg.node.text = orig.slice(0, offset) + newText + orig.slice(offset);
        const updatedPlain = extractPlainText(docObj);
        return {
          success: true,
          newDoc: docObj,
          newDocJson: JSON.stringify(docObj),
          newPlainText: updatedPlain,
          matchedFrom: targetFrom,
          matchedTo: targetFrom + newText.length,
        };
      }
    }

    return {
      success: false,
      newDoc: docObj,
      newDocJson: JSON.stringify(docObj),
      newPlainText: plainText,
      error: "No overlapping document nodes found for replacement range",
    };
  }

  const nodeSegments = overlapSegments.filter((seg) => seg.node || seg.type === "text");
  if (nodeSegments.length === 0) {
    return {
      success: false,
      newDoc: docObj,
      newDocJson: JSON.stringify(docObj),
      newPlainText: plainText,
      error: "No text nodes overlapped by replacement range",
    };
  }

  // Case 1: Single text node replacement
  if (nodeSegments.length === 1 && nodeSegments[0].type === "text" && nodeSegments[0].node) {
    const seg = nodeSegments[0];
    const node = seg.node;
    if (node) {
      const origText = node.text || "";
      const startInNode = Math.max(0, targetFrom - seg.plainStart);
      const endInNode = Math.min(origText.length, targetTo - seg.plainStart);

      node.text = origText.slice(0, startInNode) + newText + origText.slice(endInNode);

      const updatedPlain = extractPlainText(docObj);
      return {
        success: true,
        newDoc: docObj,
        newDocJson: JSON.stringify(docObj),
        newPlainText: updatedPlain,
        matchedFrom: targetFrom,
        matchedTo: targetFrom + newText.length,
      };
    }
  }

  // Case 2: Multi-node replacement within same block (e.g. bold + regular text)
  const firstBlock = nodeSegments[0].blockNode;
  const isSameBlock = nodeSegments.every((s) => s.blockNode === firstBlock);

  if (isSameBlock) {
    const firstSeg = nodeSegments[0];
    const lastSeg = nodeSegments[nodeSegments.length - 1];

    if (firstSeg.type === "text" && firstSeg.node) {
      const origText = firstSeg.node.text || "";
      const startInNode = Math.max(0, targetFrom - firstSeg.plainStart);
      firstSeg.node.text = origText.slice(0, startInNode) + newText;
    }

    if (lastSeg !== firstSeg && lastSeg.type === "text" && lastSeg.node) {
      const origText = lastSeg.node.text || "";
      const endInNode = Math.min(origText.length, targetTo - lastSeg.plainStart);
      lastSeg.node.text = origText.slice(endInNode);
    }

    for (let i = 1; i < nodeSegments.length - 1; i++) {
      const midSeg = nodeSegments[i];
      if (midSeg.node && midSeg.node.type === "text") {
        midSeg.node.text = "";
      }
    }

    // Clean up empty text nodes
    if (firstSeg.parentNode && Array.isArray(firstSeg.parentNode.content)) {
      firstSeg.parentNode.content = firstSeg.parentNode.content.filter(
        (child: any) => !(child.type === "text" && child.text === "")
      );
      if (firstSeg.parentNode.content.length === 0) {
        firstSeg.parentNode.content = [{ type: "text", text: "" }];
      }
    }

    const updatedPlain = extractPlainText(docObj);
    return {
      success: true,
      newDoc: docObj,
      newDocJson: JSON.stringify(docObj),
      newPlainText: updatedPlain,
      matchedFrom: targetFrom,
      matchedTo: targetFrom + newText.length,
    };
  }

  // Case 3: Cross-block replacement
  const startSeg = nodeSegments[0];
  const endSeg = nodeSegments[nodeSegments.length - 1];

  if (startSeg.type === "text" && startSeg.node) {
    const origText = startSeg.node.text || "";
    const startInNode = Math.max(0, targetFrom - startSeg.plainStart);
    startSeg.node.text = origText.slice(0, startInNode);
  }

  if (endSeg.type === "text" && endSeg.node) {
    const origText = endSeg.node.text || "";
    const endInNode = Math.min(origText.length, targetTo - endSeg.plainStart);
    endSeg.node.text = origText.slice(endInNode);
  }

  for (let i = 1; i < nodeSegments.length - 1; i++) {
    const mid = nodeSegments[i];
    if (mid.node && mid.node.type === "text") {
      mid.node.text = "";
    }
  }

  const newParagraphs = newText.split(/\n\n+/);
  if (newParagraphs.length === 1) {
    if (startSeg.type === "text" && startSeg.node) {
      startSeg.node.text = (startSeg.node.text || "") + newText;
    }
    if (startSeg.blockNode && endSeg.blockNode && startSeg.blockNode !== endSeg.blockNode) {
      if (Array.isArray(endSeg.blockNode.content)) {
        startSeg.blockNode.content = [
          ...(startSeg.blockNode.content || []),
          ...endSeg.blockNode.content,
        ];
      }
      const startBlockIdx = docObj.content.indexOf(startSeg.blockNode);
      const endBlockIdx = docObj.content.indexOf(endSeg.blockNode);
      if (startBlockIdx !== -1 && endBlockIdx !== -1 && endBlockIdx > startBlockIdx) {
        docObj.content.splice(startBlockIdx + 1, endBlockIdx - startBlockIdx);
      }
    }
  } else {
    if (startSeg.type === "text" && startSeg.node) {
      startSeg.node.text = (startSeg.node.text || "") + newParagraphs[0];
    }
    if (endSeg.type === "text" && endSeg.node) {
      endSeg.node.text = newParagraphs[newParagraphs.length - 1] + (endSeg.node.text || "");
    }

    const startBlockIdx = startSeg.blockNode ? docObj.content.indexOf(startSeg.blockNode) : -1;
    const endBlockIdx = endSeg.blockNode ? docObj.content.indexOf(endSeg.blockNode) : -1;

    const midBlocks = newParagraphs.slice(1, -1).map((pText) => ({
      type: "paragraph" as const,
      content: [{ type: "text" as const, text: pText }],
    }));

    if (startBlockIdx !== -1 && endBlockIdx !== -1 && endBlockIdx >= startBlockIdx) {
      docObj.content.splice(startBlockIdx + 1, endBlockIdx - startBlockIdx - 1, ...midBlocks);
    }
  }

  const updatedPlain = extractPlainText(docObj);
  return {
    success: true,
    newDoc: docObj,
    newDocJson: JSON.stringify(docObj),
    newPlainText: updatedPlain,
    matchedFrom: targetFrom,
    matchedTo: targetFrom + newText.length,
  };
}
