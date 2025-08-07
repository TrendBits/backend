import type { Request, Response } from "express";
import { error, success } from "../utils/api_response.util";
import { GoogleGenAI } from "@google/genai";
import { getDatabase, queryWithRetry } from "../configs/database";
import type { Database } from "@sqlitecloud/drivers";
import { v7 as uuidv7 } from "uuid";
import { parseGeminiJsonBlock } from "../utils/gemini_summary.util";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface HotTopic {
  icon: string;
  title: string;
  description: string;
  query: string;
}

interface StoredHotTopic extends HotTopic {
  id: string;
  batch_id: string;
  created_at: string;
  updated_at: string;
}

// Get hot topics from database (for regular API calls)
export const getHotTopics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const db: Database = await getDatabase();
    
    // Get the latest batch of hot topics
    const latestTopics = await queryWithRetry(
      () => db.sql`
        SELECT id, icon, title, description, query, batch_id, created_at
        FROM hot_topics 
        WHERE batch_id = (
          SELECT batch_id 
          FROM hot_topics 
          ORDER BY created_at DESC 
          LIMIT 1
        )
        ORDER BY created_at ASC
      `
    ) as StoredHotTopic[];

    if (latestTopics.length === 0) {
      res.status(404).json(
        error({
          title: "No Topics Found",
          message: "No hot topics available. Please try again later.",
        })
      );
      return;
    }

    // Transform to match frontend expected format
    const topics = latestTopics.map(topic => ({
      icon: topic.icon,
      title: topic.title,
      description: topic.description,
      query: topic.query
    }));

    res.json(
      success({
        title: "Hot AI Topics Retrieved",
        message: "Successfully retrieved latest AI trends",
        data: {
          topics,
          generatedAt: latestTopics[0].created_at,
          batchId: latestTopics[0].batch_id
        },
      })
    );
  } catch (err) {
    console.error("Get hot topics error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Failed to retrieve hot AI topics",
      })
    );
  }
};

// Generate and store new hot topics (for scheduled calls - 12am & 12pm)
export const generateHotTopics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Use Gemini AI to generate hot trending topics
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: `
        You are a global trend analyst for TrendBits, a platform that tracks the latest trending topics worldwide.

        Generate 6 hot trending topics that are currently popular or recently emerged globally. Each topic should be structured as a JSON object with the following schema:

        {
          "icon": "TrendingUp" | "Globe" | "Zap" | "Users" | "Calendar" | "Star" | "Heart" | "MessageCircle" | "Play" | "Music" | "Camera" | "Gamepad2",
          "title": "Concise, catchy title (max 4 words)",
          "description": "Brief description explaining what this trend is about (max 60 characters)",
          "query": "Detailed search query that would help find more information about this topic"
        }

        Focus on diverse categories:
        - Technology and innovation breakthroughs
        - Entertainment and pop culture phenomena
        - Social media viral trends and challenges
        - Sports events and achievements
        - Political developments and world events
        - Health and lifestyle trends
        - Environmental and climate news
        - Business and economic developments
        - Scientific discoveries and research
        - Cultural movements and social issues

        Return ONLY a JSON array of 6 objects, no markdown formatting or explanations.

        Example format:
        [
          {
            "icon": "TrendingUp",
            "title": "Climate Summit 2025",
            "description": "Global leaders unite on ambitious climate targets",
            "query": "COP30 climate summit 2025 global agreements carbon targets"
          }
        ]
      `,
      config: {
        thinkingConfig: {
          thinkingBudget: 512,
        },
        systemInstruction: `
          You are a trend analyst specializing in global trending topics across all categories. Your job is to identify and summarize the most current and relevant trends worldwide.
          
          Always return valid JSON arrays only. Never include markdown, explanations, or any text outside the JSON structure.
          
          Keep titles concise and impactful. Descriptions should be informative but brief. Queries should be comprehensive search terms that would yield relevant results.
          
          Focus on recent developments (within the last 1 weeks) and emerging trends that would interest a general global audience. Cover diverse topics from technology, entertainment, politics, sports, culture, and more.
        `,
      },
    });

    let hotTopics: HotTopic[];
    try {
      // Use the existing utility to clean JSON response
      const cleanedResponse = parseGeminiJsonBlock(response.text);
      
      if (!cleanedResponse) {
        throw new Error("Failed to parse JSON response");
      }
      
      hotTopics = cleanedResponse;
      
      // Validate the response structure
      if (!Array.isArray(hotTopics) || hotTopics.length !== 6) {
        throw new Error("Invalid response format");
      }
      
      // Validate each topic has required fields
      for (const topic of hotTopics) {
        if (!topic.icon || !topic.title || !topic.description || !topic.query) {
          throw new Error("Missing required fields in topic");
        }
      }
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      res.status(500).json(
        error({
          title: "AI Generation Error",
          message: "Sorry, we couldn't generate hot topics at this time. Please try again later.",
        })
      );
      return;
    }

    // Store topics in database
    const db: Database = await getDatabase();
    const batchId = uuidv7();
    const now = new Date().toISOString();

    // Insert all topics with the same batch_id
    for (const topic of hotTopics) {
      const topicId = uuidv7();
      await queryWithRetry(
        () => db.sql`
          INSERT INTO hot_topics (id, icon, title, description, query, batch_id, created_at, updated_at)
          VALUES (${topicId}, ${topic.icon}, ${topic.title}, ${topic.description}, ${topic.query}, ${batchId}, ${now}, ${now})
        `
      );
    }

    // Clean up old batches (keep only last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await queryWithRetry(
      () => db.sql`
        DELETE FROM hot_topics 
        WHERE created_at < ${sevenDaysAgo}
      `
    );

    res.status(200).json(
      success({
        title: "Hot Topics Generated",
        message: "Successfully generated and stored latest trending topics",
        data: {
          topics: hotTopics,
          generatedAt: now,
          batchId,
          stored: true
        },
      })
    );
  } catch (err) {
    console.error("Hot topics generation error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Failed to generate hot trending topics",
      })
    );
  }
};