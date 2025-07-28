import { Router } from "express";
import { authenticateToken } from "../middlewares/jwt.middleware";
import { generateSummary } from "../controllers/prompt.controller";

const promptRouter = Router();

promptRouter.post("/summary", authenticateToken, generateSummary);

export default promptRouter;
