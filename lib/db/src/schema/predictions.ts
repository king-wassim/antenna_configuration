import { pgTable, serial, timestamp, real, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const antennaConfigSchema = z.object({
  ring1: z.number().int().min(2).max(8),
  ring2: z.number().int().min(2).max(8),
  ring3: z.number().int().min(2).max(8),
  ring4: z.number().int().min(2).max(8),
  ring5: z.number().int().min(2).max(8),
});

export const performanceMetricsSchema = z.object({
  hpbw: z.number(),
  mainLobeGain: z.number(),
  sideLobeLevel: z.number(),
});

export type AntennaConfig = z.infer<typeof antennaConfigSchema>;
export type PerformanceMetrics = z.infer<typeof performanceMetricsSchema>;

export const predictionsTable = pgTable("predictions", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  theta0Deg: real("theta0_deg").notNull(),
  referenceConfig: jsonb("reference_config").$type<AntennaConfig>().notNull(),
  predictedConfig: jsonb("predicted_config").$type<AntennaConfig>().notNull(),
  referenceMetrics: jsonb("reference_metrics").$type<PerformanceMetrics>().notNull(),
  predictedMetrics: jsonb("predicted_metrics").$type<PerformanceMetrics>().notNull(),
  globalError: real("global_error").notNull(),
});

export const insertPredictionSchema = createInsertSchema(predictionsTable).omit({ id: true, createdAt: true });
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictionsTable.$inferSelect;
