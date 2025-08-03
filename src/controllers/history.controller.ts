import type { Request, Response } from "express";
import { error, success } from "../utils/api_response.util";
import { getDatabase, queryWithRetry } from "../configs/database";
import type { Database } from "@sqlitecloud/drivers";
import { v7 as uuidv7 } from "uuid";

// Interface for incoming requests (matches prompt controller output)
interface SaveTrendRequest {
  search_term: string;
  headline: string;
  summary: string;
  key_points: string[]; // Array from prompt controller
  call_to_action: string;
}

// Interface for database records (key_points stored as JSON string)
interface TrendHistoryDbItem {
  id: string;
  user_id: string;
  search_term: string;
  headline: string;
  summary: string;
  key_points: string; // JSON string from database
  call_to_action: string;
  created_at: string;
  updated_at: string;
}

// Interface for API responses (key_points parsed back to array)
interface TrendHistoryItem {
  id: string;
  user_id: string;
  search_term: string;
  headline: string;
  summary: string;
  key_points: string[]; // Array for API response
  call_to_action: string;
  created_at: string;
  updated_at: string;
}

// Helper function for safe JSON parsing
const parseKeyPoints = (keyPointsJson: string): string[] => {
  try {
    const parsed = JSON.parse(keyPointsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse key_points JSON:', error);
    return [];
  }
};

// Save generated summary to user's history
export const saveTrendSummary = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      res.status(401).json(
        error({
          title: "Authentication Required",
          message: "Please log in to save trends",
        })
      );
      return;
    }

    const {
      search_term,
      headline,
      summary,
      key_points,
      call_to_action,
    } = req.body as SaveTrendRequest;

    // Validate required fields
    if (!search_term || !headline || !summary || !key_points || !call_to_action) {
      res.status(400).json(
        error({
          title: "Validation Error",
          message: "All trend summary fields are required",
        })
      );
      return;
    }

    const db: Database = await getDatabase();
    const historyId = uuidv7();
    const now = new Date().toISOString();

    // Save to database (convert array to JSON string)
    await queryWithRetry(
      () => db.sql`
        INSERT INTO trend_history (
          id, user_id, search_term, headline, summary, 
          key_points, call_to_action, created_at, updated_at
        )
        VALUES (
          ${historyId}, ${userId}, ${search_term}, ${headline}, ${summary},
          ${JSON.stringify(key_points)}, ${call_to_action}, ${now}, ${now}
        )
      `
    );

    res.status(201).json(
      success({
        title: "Trend Saved",
        message: "Successfully saved trend to your history",
        data: {
          id: historyId,
          saved_at: now,
        },
      })
    );
  } catch (err) {
    console.error("Save trend summary error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Failed to save trend summary",
      })
    );
  }
};

// Unified endpoint for getting trends - handles pagination, search, and ID-based retrieval
export const getTrends = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      res.status(401).json(
        error({
          title: "Authentication Required",
          message: "Please log in to view your history",
        })
      );
      return;
    }

    const { id, q: searchQuery, page = "1", limit = "10" } = req.query as {
      id?: string;
      q?: string;
      page?: string;
      limit?: string;
    };

    const db: Database = await getDatabase();

    // Case 1: Get specific trend by ID
    if (id) {
      const trendResult = await queryWithRetry(
        () => db.sql`
          SELECT id, search_term, headline, summary, key_points, 
                 call_to_action, created_at, updated_at
          FROM trend_history 
          WHERE id = ${id} AND user_id = ${userId}
        `
      ) as TrendHistoryDbItem[];

      if (trendResult.length === 0) {
        res.status(404).json(
          error({
            title: "Trend Not Found",
            message: "The requested trend was not found in your history",
          })
        );
        return;
      }

      const trend: TrendHistoryItem = {
        ...trendResult[0],
        key_points: parseKeyPoints(trendResult[0].key_points),
      };

      res.json(
        success({
          title: "Trend Retrieved",
          message: "Successfully retrieved trend details",
          data: trend,
        })
      );
      return;
    }

    // Case 2: Search trends or get paginated history
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    if (searchQuery && searchQuery.trim().length > 0) {
      // Search mode
      const searchTerm = `%${searchQuery.trim()}%`;

      // Get total count for search
      const countResult = await queryWithRetry(
        () => db.sql`
          SELECT COUNT(*) as total 
          FROM trend_history 
          WHERE user_id = ${userId} 
          AND (search_term LIKE ${searchTerm} 
               OR headline LIKE ${searchTerm} 
               OR summary LIKE ${searchTerm})
        `
      ) as { total: number }[];

      const totalItems = countResult[0].total;
      const totalPages = Math.ceil(totalItems / limitNum);

      // Get search results
      const historyItems = await queryWithRetry(
        () => db.sql`
          SELECT id, search_term, headline, summary, key_points, 
                 call_to_action, created_at, updated_at
          FROM trend_history 
          WHERE user_id = ${userId} 
          AND (search_term LIKE ${searchTerm} 
               OR headline LIKE ${searchTerm} 
               OR summary LIKE ${searchTerm})
          ORDER BY created_at DESC
          LIMIT ${limitNum} OFFSET ${offset}
        `
      ) as TrendHistoryDbItem[];

      // Parse key_points JSON for each item
      const formattedHistory: TrendHistoryItem[] = historyItems.map(item => ({
        ...item,
        key_points: parseKeyPoints(item.key_points),
      }));

      res.json(
        success({
          title: "Search Results",
          message: `Found ${formattedHistory.length} trends matching your search`,
          data: {
            trends: formattedHistory,
            search: {
              query: searchQuery,
              results_count: formattedHistory.length,
              total_matches: totalItems,
            },
            pagination: {
              current_page: pageNum,
              total_pages: totalPages,
              total_items: totalItems,
              items_per_page: limitNum,
              has_next: pageNum < totalPages,
              has_prev: pageNum > 1,
            },
          },
        })
      );
    } else {
      // Pagination mode
      // Get total count
      const countResult = await queryWithRetry(
        () => db.sql`
          SELECT COUNT(*) as total 
          FROM trend_history 
          WHERE user_id = ${userId}
        `
      ) as { total: number }[];

      const totalItems = countResult[0].total;
      const totalPages = Math.ceil(totalItems / limitNum);

      // Get paginated history
      const historyItems = await queryWithRetry(
        () => db.sql`
          SELECT id, search_term, headline, summary, key_points, 
                 call_to_action, created_at, updated_at
          FROM trend_history 
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${limitNum} OFFSET ${offset}
        `
      ) as TrendHistoryDbItem[];

      // Parse key_points JSON for each item
      const formattedHistory: TrendHistoryItem[] = historyItems.map(item => ({
        ...item,
        key_points: parseKeyPoints(item.key_points),
      }));

      res.json(
        success({
          title: "Trend History Retrieved",
          message: "Successfully retrieved your trend history",
          data: {
            trends: formattedHistory,
            pagination: {
              current_page: pageNum,
              total_pages: totalPages,
              total_items: totalItems,
              items_per_page: limitNum,
              has_next: pageNum < totalPages,
              has_prev: pageNum > 1,
            },
          },
        })
      );
    }
  } catch (err) {
    console.error("Get trends error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Failed to retrieve trends",
      })
    );
  }
};

// Delete trend from history
export const deleteTrend = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.user_id;
    const trendId = req.params.id;
    
    if (!userId) {
      res.status(401).json(
        error({
          title: "Authentication Required",
          message: "Please log in to delete trends",
        })
      );
      return;
    }

    const db: Database = await getDatabase();

    const deleteResult = await queryWithRetry(
      () => db.sql`
        DELETE FROM trend_history 
        WHERE id = ${trendId} AND user_id = ${userId}
      `
    );

    res.json(
      success({
        title: "Trend Deleted",
        message: "Successfully deleted trend from your history",
      })
    );
  } catch (err) {
    console.error("Delete trend error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Failed to delete trend",
      })
    );
  }
};