import { Router, type IRouter } from "express";
import { eq, desc, avg, count, min, max } from "drizzle-orm";
import { db, predictionsTable, insertPredictionSchema } from "@workspace/db";
import {
  GetPredictionParams,
  DeletePredictionParams,
  GetRecentHistoryQueryParams,
  ListPredictionsResponse,
  GetPredictionResponse,
  GetPredictionStatsResponse,
  GetRecentHistoryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/predictions", async (req, res): Promise<void> => {
  const parsed = insertPredictionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [created] = await db.insert(predictionsTable).values(parsed.data).returning();

  if (!created) {
    res.status(500).json({ error: "Failed to save prediction" });
    return;
  }

  res.status(201).json(GetPredictionResponse.parse(created));
});

router.get("/predictions", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(predictionsTable)
    .orderBy(desc(predictionsTable.createdAt));
  res.json(ListPredictionsResponse.parse(rows));
});

router.get("/predictions/stats", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      totalPredictions: count(),
      avgGlobalError: avg(predictionsTable.globalError),
      avgHpbwError: avg(predictionsTable.globalError),
      avgMainLobeGainError: avg(predictionsTable.globalError),
      avgSidelobeLevelError: avg(predictionsTable.globalError),
    })
    .from(predictionsTable);

  const stats = rows[0];

  const bestRow = await db
    .select({ id: predictionsTable.id, globalError: predictionsTable.globalError })
    .from(predictionsTable)
    .orderBy(predictionsTable.globalError)
    .limit(1);

  const worstRow = await db
    .select({ id: predictionsTable.id, globalError: predictionsTable.globalError })
    .from(predictionsTable)
    .orderBy(desc(predictionsTable.globalError))
    .limit(1);

  res.json(
    GetPredictionStatsResponse.parse({
      totalPredictions: Number(stats.totalPredictions ?? 0),
      avgGlobalError: Number(stats.avgGlobalError ?? 0),
      avgHpbwError: Number(stats.avgHpbwError ?? 0),
      avgMainLobeGainError: Number(stats.avgMainLobeGainError ?? 0),
      avgSidelobeLevelError: Number(stats.avgSidelobeLevelError ?? 0),
      bestPredictionId: bestRow[0]?.id ?? null,
      worstPredictionId: worstRow[0]?.id ?? null,
    })
  );
});

router.get("/predictions/:id", async (req, res): Promise<void> => {
  const params = GetPredictionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(predictionsTable)
    .where(eq(predictionsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Prediction not found" });
    return;
  }

  res.json(GetPredictionResponse.parse(row));
});

router.delete("/predictions/:id", async (req, res): Promise<void> => {
  const params = DeletePredictionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(predictionsTable)
    .where(eq(predictionsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Prediction not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/history", async (req, res): Promise<void> => {
  const query = GetRecentHistoryQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 10) : 10;

  const rows = await db
    .select()
    .from(predictionsTable)
    .orderBy(desc(predictionsTable.createdAt))
    .limit(limit);

  res.json(GetRecentHistoryResponse.parse(rows));
});

export default router;
