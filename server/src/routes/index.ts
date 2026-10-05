import { Router, type IRouter } from "express";
import healthRouter from "./health";
import campusLoopRouter from "./campusloop";

const router: IRouter = Router();

router.use(healthRouter);
router.use(campusLoopRouter);

export default router;
