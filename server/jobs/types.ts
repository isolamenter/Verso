import type {
  IngestionJob,
  IngestionJobType,
} from "../../shared/schemas/knowledge";

export const INGESTION_QUEUE_NAME = "knowledge-ingestion";

export interface IngestionJobPayload {
  domainJobId: string;
  projectId: string;
  assetId: string;
  nodeId?: string;
  jobType: IngestionJobType;
  metadata?: Record<string, unknown>;
}

export interface EnqueueIngestionJobInput {
  projectId: string;
  assetId: string;
  nodeId?: string;
  jobType: IngestionJobType;
  metadata?: Record<string, unknown>;
  singletonKey?: string;
}

export interface IngestionJobContext {
  payload: IngestionJobPayload;
  bossJobId: string;
  isCancelled: () => Promise<boolean>;
  reportProgress: (progress: number, metadata?: Record<string, unknown>) => Promise<void>;
}

export type IngestionJobHandler = (ctx: IngestionJobContext) => Promise<Record<string, unknown> | void>;

export interface JobRunner {
  start(): Promise<void>;
  stop(): Promise<void>;
  enqueueIngestionJob(input: EnqueueIngestionJobInput): Promise<{ domainJobId: string; pgBossJobId: string }>;
  cancelJob(domainJobId: string): Promise<boolean>;
  getJobStatus(domainJobId: string): Promise<IngestionJob | null>;
  isStarted(): boolean;
}

