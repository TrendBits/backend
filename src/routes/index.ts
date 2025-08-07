import { Router } from "express";
import authRouter from "./auth.routes";
import promptRouter from "./prompt.routes";
import trendRouter from "./trend.routes";
import historyRouter from "./history.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/prompt", promptRouter);
router.use("/prompt/history", historyRouter);
router.use("/trend", trendRouter);

export default router;
