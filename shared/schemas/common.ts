import { z } from "zod";

export const IdSchema = z.string().min(1);
export type Id = z.infer<typeof IdSchema>;

export const MetadataSchema = z
  .record(z.string(), z.unknown())
  .default({});
export type Metadata = z.infer<typeof MetadataSchema>;

export const TimestampSchema = z.union([
  z.string(),
  z.date(),
]);
export type Timestamp = z.infer<typeof TimestampSchema>;

