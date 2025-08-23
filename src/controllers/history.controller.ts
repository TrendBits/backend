import type { Request, Response } from "express";
import { error, success } from "../utils/api_response.util";
import { getDatabase } from "../configs/database";
import { trendHistory } from "../db/schema";
import { eq, and, like, or, desc, count } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

// Interface for incoming requests (matches prompt controller output)
interface SaveTrendRequest {
  search_term: string;
  headline: string;
  summary: string;
  key_points: string[];
  call_to_action: string;
  article_references?: Array<{
    title: string;
    url: string;
    source: string;
    date: string;
  }>;
}

// Interface for API responses (key_points parsed back to array)
interface TrendHistoryItem {
  id: string;
  user_id: string;
  search_term: string;
  headline: string;
  summary: string;
  key_points: string[];
  call_to_action: string;
  article_references: Array<{
    title: string;
    url: string;
    source: string;
    date: string;
  }>;
  created_at: string;
  updated_at: string;
}

// Helper function for safe JSON parsing of keypoints
const parseKeyPoints = (keyPointsJson: string): string[] => {
  try {
    const parsed = JSON.parse(keyPointsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse key_points JSON:', error);
    return [];
  }
};

// Helper function for safe JSON parsing of article references
const parseArticleReferences = (referencesJson: string): Array<{title: string, url: string, source: string, date: string}> => {
  try {
    const parsed = JSON.parse(referencesJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse article_references JSON:', error);
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

    const db = await getDatabase();
    const historyId = uuidv7();
    const now = new Date();

    // Save to database (convert array to JSON string)
    await db.insert(trendHistory)
      .values({
        id: historyId,
        userId: userId,
        searchTerm: search_term,
        headline: headline,
        summary: summary,
        keyPoints: JSON.stringify(key_points),
        callToAction: call_to_action,
        createdAt: now,
        updatedAt: now
      });

    res.status(201).json(
      success({
        title: "Trend Saved",
        message: "Successfully saved trend to your history",
        data: {
          id: historyId,
          saved_at: now.toISOString(),
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

    const db = await getDatabase();

    // Case 1: Get specific trend by ID
    if (id) {
      const trendResult = await db.select({
        id: trendHistory.id,
        searchTerm: trendHistory.searchTerm,
        headline: trendHistory.headline,
        summary: trendHistory.summary,
        keyPoints: trendHistory.keyPoints,
        articleReferences: trendHistory.articleReferences,
        callToAction: trendHistory.callToAction,
        createdAt: trendHistory.createdAt,
        updatedAt: trendHistory.updatedAt
      })
      .from(trendHistory)
      .where(and(
        eq(trendHistory.id, id),
        eq(trendHistory.userId, userId)
      ));

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
        id: trendResult[0].id,
        user_id: userId,
        search_term: trendResult[0].searchTerm,
        headline: trendResult[0].headline,
        summary: trendResult[0].summary,
        key_points: parseKeyPoints(trendResult[0].keyPoints),
        call_to_action: trendResult[0].callToAction,
        article_references: parseArticleReferences(trendResult[0].articleReferences || '[]'),
        created_at: trendResult[0].createdAt?.toISOString() || '',
        updated_at: trendResult[0].updatedAt?.toISOString() || ''
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
      const countResult = await db.select({ total: count() })
        .from(trendHistory)
        .where(and(
          eq(trendHistory.userId, userId),
          or(
            like(trendHistory.searchTerm, searchTerm),
            like(trendHistory.headline, searchTerm),
            like(trendHistory.summary, searchTerm)
          )
        ));

      const totalItems = countResult[0].total;
      const totalPages = Math.ceil(totalItems / limitNum);

      // Get search results
      const historyItems = await db.select({
        id: trendHistory.id,
        searchTerm: trendHistory.searchTerm,
        headline: trendHistory.headline,
        summary: trendHistory.summary,
        keyPoints: trendHistory.keyPoints,
        articleReferences: trendHistory.articleReferences,
        callToAction: trendHistory.callToAction,
        createdAt: trendHistory.createdAt,
        updatedAt: trendHistory.updatedAt
      })
      .from(trendHistory)
      .where(and(
        eq(trendHistory.userId, userId),
        or(
          like(trendHistory.searchTerm, searchTerm),
          like(trendHistory.headline, searchTerm),
          like(trendHistory.summary, searchTerm)
        )
      ))
      .orderBy(desc(trendHistory.createdAt))
      .limit(limitNum)
      .offset(offset);

      // Parse key_points JSON for each item
      const formattedHistory: TrendHistoryItem[] = historyItems.map(item => ({
        id: item.id,
        user_id: userId,
        search_term: item.searchTerm,
        headline: item.headline,
        summary: item.summary,
        key_points: parseKeyPoints(item.keyPoints),
        call_to_action: item.callToAction,
        article_references: parseArticleReferences(item.articleReferences || '[]'),
        created_at: item.createdAt?.toISOString() || '',
        updated_at: item.updatedAt?.toISOString() || ''
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
      const countResult = await db.select({ total: count() })
        .from(trendHistory)
        .where(eq(trendHistory.userId, userId));

      const totalItems = countResult[0].total;
      const totalPages = Math.ceil(totalItems / limitNum);

      // Get paginated history
      const historyItems = await db.select({
        id: trendHistory.id,
        searchTerm: trendHistory.searchTerm,
        headline: trendHistory.headline,
        summary: trendHistory.summary,
        keyPoints: trendHistory.keyPoints,
        callToAction: trendHistory.callToAction,
        createdAt: trendHistory.createdAt,
        updatedAt: trendHistory.updatedAt
      })
      .from(trendHistory)
      .where(eq(trendHistory.userId, userId))
      .orderBy(desc(trendHistory.createdAt))
      .limit(limitNum)
      .offset(offset);

      // Parse key_points JSON for each item
      const formattedHistory: TrendHistoryItem[] = historyItems.map(item => ({
        id: item.id,
        user_id: userId,
        search_term: item.searchTerm,
        headline: item.headline,
        summary: item.summary,
        key_points: parseKeyPoints(item.keyPoints),
        call_to_action: item.callToAction,
        article_references: parseArticleReferences('[]'),
        created_at: item.createdAt?.toISOString() || '',
        updated_at: item.updatedAt?.toISOString() || ''
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

// Get specific trend by ID
export const getTrendById = async (
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

    const { id } = req.params;

    if (!id) {
      res.status(400).json(
        error({
          title: "Validation Error",
          message: "Trend ID is required",
        })
      );
      return;
    }

    const db = await getDatabase();

    const trendResult = await db.select({
      id: trendHistory.id,
      searchTerm: trendHistory.searchTerm,
      headline: trendHistory.headline,
      summary: trendHistory.summary,
      keyPoints: trendHistory.keyPoints,
      articleReferences: trendHistory.articleReferences,
      callToAction: trendHistory.callToAction,
      createdAt: trendHistory.createdAt,
      updatedAt: trendHistory.updatedAt
    })
    .from(trendHistory)
    .where(and(
      eq(trendHistory.id, id),
      eq(trendHistory.userId, userId)
    ));

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
      id: trendResult[0].id,
      user_id: userId,
      search_term: trendResult[0].searchTerm,
      headline: trendResult[0].headline,
      summary: trendResult[0].summary,
      key_points: parseKeyPoints(trendResult[0].keyPoints),
      call_to_action: trendResult[0].callToAction,
      article_references: parseArticleReferences(trendResult[0].articleReferences || '[]'),
      created_at: trendResult[0].createdAt?.toISOString() || '',
      updated_at: trendResult[0].updatedAt?.toISOString() || ''
    };

    res.json(
      success({
        title: "Trend Retrieved",
        message: "Successfully retrieved trend details",
        data: trend,
      })
    );
  } catch (err) {
    console.error("Get trend by ID error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Failed to retrieve trend",
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

    const db = await getDatabase();

    await db.delete(trendHistory)
      .where(and(
        eq(trendHistory.id, trendId),
        eq(trendHistory.userId, userId)
      ));

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
