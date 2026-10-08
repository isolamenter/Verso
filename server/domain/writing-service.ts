import { db } from "../db/client";
import {
  agentArtifacts,
  scenes,
  sceneRevisions,
  knowledgeNodes,
} from "../db/schema";
import { and, eq, desc } from "drizzle-orm";
import {
  extractPlainText,
  isTipTapDocJson,
  plainTextToTipTapDoc,
} from "../../shared/manuscript";
import { RevisionConflictError } from "./manuscripts/manuscript-service";

export async function selectDraft(
  projectId: string,
  artifactId: string,
  disposition: "adopted" | "material" | "dismissed",
  sceneId?: string,
  expectedBaseRevisionId?: string,
  selectedText?: string,
) {
  return db.transaction(async (tx) => {
    const [draft] = await tx
      .select()
      .from(agentArtifacts)
      .where(
        and(
          eq(agentArtifacts.id, artifactId),
          eq(agentArtifacts.projectId, projectId),
        ),
      )
      .for("update");
    if (!draft || draft.type !== "scene_draft") throw new Error("试写不存在");
    if (draft.metadata.disposition) throw new Error("此试写已处理");
    let revisionId: string | undefined;
    if (disposition === "adopted") {
      if (!selectedText?.trim() || !draft.content.includes(selectedText))
        throw new Error("请选择试写中的原文内容");
      const [scene] = await tx
        .select()
        .from(scenes)
        .where(
          and(eq(scenes.id, sceneId || ""), eq(scenes.projectId, projectId)),
        )
        .for("update");
      if (!scene || scene.currentRevisionId !== expectedBaseRevisionId)
        throw new RevisionConflictError(
          sceneId || "",
          expectedBaseRevisionId || "",
          scene?.currentRevisionId || "",
        );
      const doc = isTipTapDocJson(scene.content)
        ? JSON.parse(scene.content)
        : plainTextToTipTapDoc(scene.content);
      const hasText = Boolean(extractPlainText(doc).trim());
      const content = JSON.stringify({
        type: "doc",
        content: [
          ...(hasText ? doc.content : []),
          ...plainTextToTipTapDoc(selectedText).content,
        ],
      });
      const [latest] = await tx
        .select()
        .from(sceneRevisions)
        .where(eq(sceneRevisions.sceneId, scene.id))
        .orderBy(desc(sceneRevisions.revisionNumber))
        .limit(1);
      revisionId = crypto.randomUUID();
      await tx
        .insert(sceneRevisions)
        .values({
          id: revisionId,
          sceneId: scene.id,
          projectId,
          revisionNumber: (latest?.revisionNumber || 0) + 1,
          changeType: "ai_accepted",
          description: `选入试写：${draft.title}`,
          content,
          characterCount: extractPlainText(content).length,
          metadata: { artifactId },
        });
      await tx
        .update(scenes)
        .set({
          content,
          currentRevisionId: revisionId,
          characterCount: extractPlainText(content).length,
          updatedAt: new Date(),
        })
        .where(eq(scenes.id, scene.id));
    }
    if (disposition === "material")
      await tx
        .insert(knowledgeNodes)
        .values({
          id: crypto.randomUUID(),
          projectId,
          kind: "reference_document",
          title: draft.title,
          content: draft.content,
          authority: "agent_unreviewed",
          status: "draft",
          metadata: {
            sourceArtifactId: artifactId,
            role: "material",
            source: "助手试写，尚未选入正文",
          },
        });
    await tx
      .update(agentArtifacts)
      .set({
        metadata: {
          ...draft.metadata,
          disposition,
          selectedText,
          sceneId,
          resultingRevisionId: revisionId,
        },
      })
      .where(eq(agentArtifacts.id, artifactId));
    return { success: true, revisionId };
  });
}
