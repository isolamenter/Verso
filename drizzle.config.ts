import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.VERSO_DATABASE_URL || "postgres://verso:verso_dev_secret@127.0.0.1:5432/verso",
  },
});

