import { Router, type IRouter } from "express";
import { SimulateAntennaBody, CompareConfigurationsBody } from "@workspace/api-zod";
import { simulateRadiationPattern, computeMetrics, computeErrors } from "../lib/antenna-physics";

const router: IRouter = Router();

router.post("/simulate", async (req, res): Promise<void> => {
  const parsed = SimulateAntennaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { config, theta0Deg = 90 } = parsed.data;
  const pattern = simulateRadiationPattern(config, theta0Deg);
  const metrics = computeMetrics(config, theta0Deg);

  res.json({ config, theta0Deg, pattern, metrics });
});

router.post("/simulate/compare", async (req, res): Promise<void> => {
  const parsed = CompareConfigurationsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { reference, predicted, theta0Deg = 90 } = parsed.data;

  const refPattern = simulateRadiationPattern(reference, theta0Deg);
  const predPattern = simulateRadiationPattern(predicted, theta0Deg);
  const refMetrics = computeMetrics(reference, theta0Deg);
  const predMetrics = computeMetrics(predicted, theta0Deg);
  const errors = computeErrors(refMetrics, predMetrics);

  res.json({
    theta0Deg,
    reference: { config: reference, pattern: refPattern, metrics: refMetrics },
    predicted: { config: predicted, pattern: predPattern, metrics: predMetrics },
    errors,
  });
});

export default router;
