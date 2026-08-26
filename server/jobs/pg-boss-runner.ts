import { PgBoss } from "pg-boss";
import { env } from "../config/env";
import { knowledgeRepository } from "../domain";
import type {
  JobRunner,
  EnqueueIngestionJobInput,
  IngestionJobPayload,
  IngestionJobContext,
} from "./types";
import { INGESTION_QUEUE_NAME } from "./types";
import { IngestionHandlers } from "./handlers/ingestion-handlers";
import type { IngestionJob } from "../../shared/schemas/knowledge";
import type { Job } from "pg-boss";

export class PgBossJobRunner implements JobRunner {
  private boss: PgBoss;
  private started = false;

  constructor(customConnectionString?: string) {
    this.boss = new PgBoss({
      connectionString: customConnectionString ?? env.VERSO_DATABASE_URL,
      schema: "pgboss",
      max: 10,
      useListenNotify: true,
    });
  }

  isStarted(): boolean {
    return this.started;
  }

  /**
   * Starts the PgBoss instance and subscribes the ingestion worker queue.
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    await this.boss.start();
    this.started = true;

    // Create / ensure named queue with bounded retries and instant notification
    try {
      await this.boss.createQueue(INGESTION_QUEUE_NAME, {
        retryLimit: 3,
        retryDelay: 2,
        retryBackoff: true,
      });
    } catch {
      // Queue may already exist
    }

    // Register worker handler
    await this.boss.work<IngestionJobPayload>(
      INGESTION_QUEUE_NAME,
      {
        batchSize: 1,
        pollingIntervalSeconds: 0.5,
      },
      async (jobs: Job<IngestionJobPayload>[]) => {
        for (const job of jobs) {
          await this.processJob(job);
        }
      }
    );

    console.log(`[Verso Job Runner] PgBoss started and listening on queue '${INGESTION_QUEUE_NAME}'.`);
  }

  /**
   * Gracefully stops the PgBoss instance.
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    await this.boss.stop({ graceful: true, timeout: 5000 });
    this.started = false;
    console.log("[Verso Job Runner] PgBoss stopped.");
  }

  /**
   * Enqueues an ingestion job with idempotency key and tracks domain state in PostgreSQL.
   */
  async enqueueIngestionJob(
    input: EnqueueIngestionJobInput
  ): Promise<{ domainJobId: string; pgBossJobId: string }> {
    if (!this.started) {
      await this.start();
    }

    // 1. Create domain job record in PostgreSQL
    const domainJob = await knowledgeRepository.createIngestionJob({
      projectId: input.projectId,
      assetId: input.assetId,
      nodeId: input.nodeId,
      jobType: input.jobType,
      status: "pending",
      metadata: input.metadata ?? {},
    });

    const payload: IngestionJobPayload = {
      domainJobId: domainJob.id,
      projectId: input.projectId,
      assetId: input.assetId,
      nodeId: input.nodeId,
      jobType: input.jobType,
      metadata: input.metadata,
    };

    const singletonKey = input.singletonKey ?? `${input.jobType}:${input.assetId}`;

    // 2. Send to pg-boss with bounded retries and singleton key
    const bossJobId = await this.boss.send(INGESTION_QUEUE_NAME, payload, {
      singletonKey,
      retryLimit: 3,
      retryDelay: 2,
      retryBackoff: true,
      expireInSeconds: 300,
    });

    // 3. Update domain record with pgBossJobId if available
    if (bossJobId) {
      await knowledgeRepository.updateIngestionJob(domainJob.id, {
        metadata: {
          ...input.metadata,
          pgBossJobId: bossJobId,
          singletonKey,
        },
      });
    }

    return {
      domainJobId: domainJob.id,
      pgBossJobId: bossJobId ?? "",
    };
  }

  /**
   * Cancels a domain job and cancels its pg-boss task if queued.
   */
  async cancelJob(domainJobId: string): Promise<boolean> {
    const job = await knowledgeRepository.getIngestionJobById(domainJobId);
    if (!job) {
      return false;
    }

    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      return false;
    }

    await knowledgeRepository.updateIngestionJob(domainJobId, {
      status: "cancelled",
      completedAt: new Date().toISOString(),
    });

    if (job.pgBossJobId) {
      try {
        await this.boss.cancel(INGESTION_QUEUE_NAME, job.pgBossJobId);
      } catch {
        // Ignore if already cancelled or completed
      }
    }

    return true;
  }

  /**
   * Retrieves domain job status.
   */
  async getJobStatus(domainJobId: string): Promise<IngestionJob | null> {
    return await knowledgeRepository.getIngestionJobById(domainJobId);
  }

  /**
   * Internal job processor that handles domain state transitions, cancellation, and progress.
   */
  private async processJob(job: Job<IngestionJobPayload>): Promise<void> {
    const payload = job.data;
    if (!payload || !payload.domainJobId) {
      return;
    }

    const domainJob = await knowledgeRepository.getIngestionJobById(payload.domainJobId);

    if (!domainJob) {
      // Clean up orphaned job silently
      return;
    }

    // If domain job is already marked cancelled or completed, abort
    if (domainJob.status === "cancelled" || domainJob.status === "completed") {
      return;
    }

    // Transition status to processing
    await knowledgeRepository.updateIngestionJob(domainJob.id, {
      status: "processing",
      startedAt: new Date().toISOString(),
      progress: 0,
    });

    const isCancelled = async (): Promise<boolean> => {
      const current = await knowledgeRepository.getIngestionJobById(domainJob.id);
      return current?.status === "cancelled";
    };

    const reportProgress = async (
      progress: number,
      metadata?: Record<string, unknown>
    ): Promise<void> => {
      const mergedMetadata = {
        ...(domainJob.metadata || {}),
        ...(metadata || {}),
      };
      await knowledgeRepository.updateIngestionJob(domainJob.id, {
        progress,
        metadata: mergedMetadata,
      });
    };

    const ctx: IngestionJobContext = {
      payload,
      bossJobId: job.id,
      isCancelled,
      reportProgress,
    };

    try {
      if (await isCancelled()) {
        await knowledgeRepository.updateIngestionJob(domainJob.id, {
          status: "cancelled",
          completedAt: new Date().toISOString(),
        });
        return;
      }

      await IngestionHandlers.handleJob(ctx);

      if (await isCancelled()) {
        await knowledgeRepository.updateIngestionJob(domainJob.id, {
          status: "cancelled",
          completedAt: new Date().toISOString(),
        });
        return;
      }

      // Mark completed
      await knowledgeRepository.updateIngestionJob(domainJob.id, {
        status: "completed",
        progress: 100,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[Verso Job Runner] Job failed (${payload.domainJobId}):`, err);

      await knowledgeRepository.updateIngestionJob(domainJob.id, {
        status: "failed",
        error: errorMessage,
        completedAt: new Date().toISOString(),
      });

      // Re-throw so pg-boss tracks failures / retries
      throw err;
    }
  }
}

export const jobRunner = new PgBossJobRunner();

