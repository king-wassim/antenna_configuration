import { Router, type IRouter } from "express";
import healthRouter from "./health";
import simulateRouter from "./simulate";
import predictionsRouter from "./predictions";
import inferRouter from "./infer";

const router: IRouter = Router();

router.use(healthRouter);
router.use(simulateRouter);
router.use(predictionsRouter);
router.use(inferRouter);

export default router;
