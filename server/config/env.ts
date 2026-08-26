import { z } from "zod";
import dotenv from "dotenv";

// Load local .env file if present
dotenv.config();

const isLoopbackHost = (host: string): boolean => {
  const normalized = host.trim().toLowerCase();
  const loopbacks = ["127.0.0.1", "localhost", "::1", "::ffff:127.0.0.1"];
  return loopbacks.includes(normalized);
};

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  VERSO_CONTAINER: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === "1"),
  VERSO_DATABASE_URL: z
    .string()
    .default("postgres://verso:verso_dev_secret@127.0.0.1:5432/verso"),
  VERSO_DATA_DIR: z.string().default("./data"),
  VERSO_HOST: z.string().default("127.0.0.1"),
  VERSO_PORT: z.coerce.number().int().positive().default(4173),
  VERSO_ALLOW_REMOTE: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === "1"),
  VERSO_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((s) => s.trim()) : [])),

  // OpenAI-compatible model configuration
  VERSO_OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  VERSO_OPENAI_API_KEY: z.string().optional().default(""),
  VERSO_REASONING_MODEL: z.string().default("gpt-4o"),
  VERSO_FAST_MODEL: z.string().default("gpt-4o-mini"),
  VERSO_MEDIA_MODEL: z.string().default("gpt-4o"),
  VERSO_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  VERSO_DEFAULT_LOCALE: z.enum(["zh-CN", "en-US"]).default("zh-CN"),

  // Budgets & Limits
  VERSO_CONTEXT_BUDGET: z.coerce.number().int().positive().default(128000),
  VERSO_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(4096),
  VERSO_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  VERSO_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(104857600), // 100MB
});

export type ServerEnv = z.infer<typeof envSchema>;

export function validateEnv(customEnv?: Record<string, string | undefined>): ServerEnv {
  const raw = customEnv ?? process.env;
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    console.error("[Verso Config] Invalid environment configuration:", parsed.error.format());
    throw new Error(`[Verso Config] Invalid environment configuration: ${parsed.error.message}`);
  }

  const config = parsed.data;

  // Loopback startup guard:
  // In the default profile, Verso must only bind to a loopback address unless running in container
  // (where Compose maps 127.0.0.1:4173:4173) or VERSO_ALLOW_REMOTE is explicitly configured.
  const isLoopback = isLoopbackHost(config.VERSO_HOST);
  if (!isLoopback && !config.VERSO_CONTAINER && !config.VERSO_ALLOW_REMOTE) {
    const errorMsg =
      `[Verso Security Guard] Refusing to start on non-loopback host '${config.VERSO_HOST}'. ` +
      `Verso single-user mode is loopback-only (127.0.0.1, localhost, ::1) to prevent accidental network exposure.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  return config;
}

// Singleton validated env evaluated on module load for server
export const env = validateEnv();

