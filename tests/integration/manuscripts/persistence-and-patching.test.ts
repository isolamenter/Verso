import { describe, it, expect } from "vitest";
import { projectRepository, manuscriptService, RevisionConflictError } from "../../../server/domain";
import {
  extractPlainText,
  applyPlainTextPatchToTipTapDoc,
  computeTextChecksum,
  findBestAnchorMatch,
  type TipTapDoc,
} from "../../../shared/manuscript";

describe("E08 — Manuscript, Scene, and Revision Server Persistence", () => {
  it("preserves TipTap JSON and plain text projection across save, reload, revision, and restore", async () => {
    const project = await projectRepository.createProject({ title: "Rich Text Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "Book 1", order: 1 });

    const richDoc: TipTapDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "第一章：夜色" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "窗外的雨落在青石板上，" },
            { type: "text", marks: [{ type: "bold" }], text: "格外清脆。" },
          ],
        },
        {
          type: "blockquote",
          content: [
            { type: "text", text: "「那时的记忆总带着潮湿的墨香。」" },
          ],
        },
      ],
    };

    const docJson = JSON.stringify(richDoc);
    const scene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "第一场",
      content: docJson,
      order: 1,
    });

    expect(scene.currentRevisionId).toBeDefined();

    // 1. Verify plain text extraction preserves block boundaries and text
    const plain = extractPlainText(docJson);
    expect(plain).toContain("第一章：夜色");
    expect(plain).toContain("格外清脆。");
    expect(plain).toContain("「那时的记忆总带着潮湿的墨香。」");

    // 2. Save revision 2 (manual edit)
    const rev1 = await manuscriptService.getLatestSceneRevision(scene.id, project.id);
    expect(rev1?.revisionNumber).toBe(1);

    const updatedDoc: TipTapDoc = structuredClone(richDoc);
    updatedDoc.content[1].content![0].text = "窗外的细雨落在青石板上，";
    const updatedJson = JSON.stringify(updatedDoc);

    const { scene: updatedScene, revision: rev2 } = await manuscriptService.saveSceneContent(
      scene.id,
      project.id,
      updatedJson,
      {
        expectedBaseRevisionId: rev1!.id,
        changeType: "manual_edit",
        description: "Added adjective to rain",
      }
    );

    expect(rev2.revisionNumber).toBe(2);
    expect(rev2.changeType).toBe("manual_edit");
    expect(updatedScene.currentRevisionId).toBe(rev2.id);

    // 3. Restore to revision 1 (atomic rollback creates rev 3 without deleting history)
    const { scene: restoredScene, revision: rev3 } = await manuscriptService.restoreSceneRevision(
      scene.id,
      project.id,
      rev1!.id
    );

    expect(rev3.revisionNumber).toBe(3);
    expect(rev3.changeType).toBe("rollback");
    expect(rev3.rollbackSourceRevId).toBe(rev1!.id);
    expect(restoredScene.currentRevisionId).toBe(rev3.id);

    // Assert restored content exactly matches rev 1
    const restoredDoc = JSON.parse(restoredScene.content);
    expect(restoredDoc.content[1].content[0].text).toBe("窗外的雨落在青石板上，");

    // Verify full history contains all 3 revisions in descending order
    const history = await manuscriptService.listSceneRevisions(scene.id, project.id);
    expect(history.length).toBe(3);
    expect(history[0].revisionNumber).toBe(3);
    expect(history[1].revisionNumber).toBe(2);
    expect(history[2].revisionNumber).toBe(1);
  });

  it("detects and rejects concurrent base-revision conflicts", async () => {
    const project = await projectRepository.createProject({ title: "Conflict Test Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "Book 1" });
    const scene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "Scene Conflict",
      content: "Base text 1",
    });

    const rev1 = await manuscriptService.getLatestSceneRevision(scene.id, project.id);

    // User A updates scene -> Rev 2
    await manuscriptService.saveSceneContent(scene.id, project.id, "User A text", {
      expectedBaseRevisionId: rev1!.id,
    });

    // User B tries to update using stale Rev 1 as base -> Conflict!
    await expect(
      manuscriptService.saveSceneContent(scene.id, project.id, "User B text", {
        expectedBaseRevisionId: rev1!.id,
      })
    ).rejects.toThrow(RevisionConflictError);
  });

  it("performs cross-node and cross-block TipTap JSON patching preserving document structure", () => {
    const richDoc: TipTapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "先生在书房中缓缓踱步，" },
            { type: "text", marks: [{ type: "italic" }], text: "若有所思。" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "案上的残茶早已凉透。" },
          ],
        },
      ],
    };

    // Patch crossing from paragraph 1 italic into paragraph 2
    const patchResult = applyPlainTextPatchToTipTapDoc(richDoc, {
      quote: "若有所思。\n\n案上的残茶早已凉透。",
      replacementContent: "神色凝重。\n\n炉中的香火忽明忽暗。",
    });

    expect(patchResult.success).toBe(true);
    expect(patchResult.newPlainText).toContain("先生在书房中缓缓踱步，");
    expect(patchResult.newPlainText).toContain("神色凝重。");
    expect(patchResult.newPlainText).toContain("炉中的香火忽明忽暗。");
    expect(patchResult.newDoc.type).toBe("doc");
    expect(patchResult.newDoc.content.length).toBe(2);
  });

  it("rejects ambiguous duplicate anchors when no disambiguating context is provided", () => {
    const text = "他说好。过了一会儿，他又说好。最后大家散去。";
    const match = findBestAnchorMatch({
      plainText: text,
      quote: "说好",
      // No prefix/suffix anchor and no range hint
    });

    expect(match.found).toBe(false);
    expect(match.isAmbiguous).toBe(true);

    // When prefixAnchor is provided, successfully disambiguates
    const disambiguated = findBestAnchorMatch({
      plainText: text,
      quote: "说好",
      prefixAnchor: "他又",
    });

    expect(disambiguated.found).toBe(true);
    expect(disambiguated.isAmbiguous).toBe(false);
    expect(disambiguated.range.from).toBe(text.lastIndexOf("说好"));
  });

  it("calculates deterministic checksums for content integrity checking", () => {
    const content = "秋风萧瑟天气凉，草木摇落露为霜。";
    const checksum1 = computeTextChecksum(content);
    const checksum2 = computeTextChecksum(content);
    expect(checksum1).toBe(checksum2);
    expect(checksum1.length).toBe(8);

    const changed = "秋风萧瑟天气凉，草木摇落露为霜！";
    const checksumChanged = computeTextChecksum(changed);
    expect(checksumChanged).not.toBe(checksum1);
  });
});
