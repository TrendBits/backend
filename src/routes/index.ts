import { Router } from "express";
import authRouter from "./auth.routes";
import promptRouter from "./prompt.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/prompt", promptRouter);

export default router;
