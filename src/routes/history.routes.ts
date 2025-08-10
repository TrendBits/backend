import { Router } from "express";
import { authenticateToken } from "../middlewares/jwt.middleware";
import {
  saveTrendSummary,
  getTrends,
  getTrendById,
  deleteTrend,
} from "../controllers/history.controller";

const historyRouter = Router();

// All history routes require authentication
historyRouter.use(authenticateToken);

// POST /history - Save a trend summary to user's history
historyRouter.post("/", saveTrendSummary);

// GET /history/:id - Get specific trend by ID
historyRouter.get("/:id", getTrendById);

// GET /history - Unified endpoint for all trend retrieval operations
// Supports multiple query patterns:
// - ?q=search_term - Search trends (with optional pagination)
// - ?page=1&limit=10 - Get paginated history
// - ?q=search_term&page=1&limit=10 - Search with pagination
historyRouter.get("/", getTrends);

// DELETE /history/:id - Delete trend from history
historyRouter.delete("/:id", deleteTrend);

export default historyRouter;
