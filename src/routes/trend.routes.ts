import { Router } from "express";
import { generateHotTopics, getHotTopics } from "../controllers/trend.controller";

const trendRouter = Router();

// Public endpoint - Get cached hot topics from database
trendRouter.get("/hot-topics", getHotTopics);

// Internal endpoint - Generate new hot topics (called by cron job)
trendRouter.post("/generate", generateHotTopics);

export default trendRouter;
