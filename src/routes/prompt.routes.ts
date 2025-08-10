import { Router } from "express";
import { generateSummary } from "../controllers/prompt.controller";
import { guestOrAuthMiddleware } from "../middlewares/guest.middleware";

const promptRouter = Router();

promptRouter.post("/summary", guestOrAuthMiddleware, generateSummary);

export default promptRouter;
