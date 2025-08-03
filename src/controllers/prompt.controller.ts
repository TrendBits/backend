import type { Request, Response } from "express";
import { error, success } from "../utils/api_response.util";
import { PromptRequest } from "../types/prompt.types";
import { GoogleGenAI } from "@google/genai";
import {
  geminiSummaryJsonExample,
  filterGeminiSummarySections,
  validateGeminiSummary,
} from "../utils/gemini_summary.util";
import { getDatabase, queryWithRetry } from "../configs/database";
import type { Database } from "@sqlitecloud/drivers";
import { v7 as uuidv7 } from "uuid";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const generateSummary = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { prompt } = req.body as PromptRequest;
    // Get user ID from JWT middleware
    const userId = req.user?.user_id; 

    if (!prompt || !prompt.trim()) {
      res.status(400).json(
        error({
          title: "Validation Error",
          message: "Please provide a trend to summarize",
        })
      );
      return;
    }

    // Use Gemini AI to generate a structured, comprehensive AI-focused summary
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: `
        You are an AI technology expert and trend analyst for TrendBits, a platform specializing in artificial intelligence developments and innovations.

        Your task is to create a **comprehensive, detailed analysis** of the given AI trend, formatted as an engaging **3-5 minute podcast segment**. This should be substantially more detailed than a typical summary - users want to understand the full scope and implications of what they're missing out on.

        Your output must strictly follow this JSON structure:

        Gemini Podcast Summary JSON Example:
        ${geminiSummaryJsonExample}

        **CONTENT REQUIREMENTS:**

        📊 **Summary Field (200-400 words)**: Create a comprehensive narrative that includes:
        - **Background Context**: What led to this development? Historical context within AI
        - **Technical Details**: Explain the technology, methodology, or approach in accessible terms
        - **Key Players**: Companies, researchers, institutions involved
        - **Current Impact**: How this is affecting the AI landscape right now
        - **Market Implications**: Business, economic, or industry effects
        - **Future Trajectory**: Where this trend is heading, potential developments
        - **Why It Matters**: The broader significance for AI advancement and society

        🎯 **Key Points (6-8 detailed points)**: Each point should be substantial (15-25 words) covering:
        - Specific technical achievements or breakthroughs
        - Quantifiable metrics, funding amounts, performance improvements
        - Strategic partnerships, acquisitions, or collaborations
        - Competitive landscape changes
        - Regulatory or ethical implications
        - Real-world applications and use cases
        - Expert opinions or industry reactions
        - Timeline milestones and upcoming developments

        🎙️ **Tone & Style**:
        - Write as if explaining to tech-savvy professionals who want deep insights
        - Use specific terminology but explain complex concepts clearly
        - Include concrete examples, case studies, and real-world applications
        - Reference recent developments, dates, and specific figures when relevant
        - Make connections to broader AI trends and ecosystem developments

        ❌ **STRICT REQUIREMENTS**:
        - Focus EXCLUSIVELY on AI, machine learning, or related technology trends
        - NO generic business or non-tech topics unless directly AI-related
        - NO brief or surface-level explanations - go deep
        - NO speculation without basis - stick to facts and informed analysis
        - Output ONLY pure JSON, no markdown or explanations

        **AI Trend to Analyze:**
        ${prompt.trim()}
      `,
      config: {
        thinkingConfig: {
          thinkingBudget: 1024,
        },
        systemInstruction: `
          You are a senior AI technology analyst and podcast content creator specializing in artificial intelligence trends, breakthroughs, and industry developments.

          Your expertise covers:
          - Machine learning and deep learning advances
          - AI model architectures and training methodologies
          - AI hardware and infrastructure developments
          - AI startup ecosystem and venture funding
          - Enterprise AI adoption and implementation
          - AI research breakthroughs from academia and industry
          - AI policy, ethics, and regulatory developments
          - AI applications across industries (healthcare, finance, autonomous systems, etc.)

          Your goal is to provide comprehensive, detailed analysis that helps users understand not just WHAT is happening, but WHY it matters, HOW it works, and WHERE it's heading.

          Always prioritize:
          - Technical accuracy and depth
          - Business and strategic implications
          - Connections to broader AI ecosystem trends
          - Actionable insights for professionals in the field
          - Concrete examples and real-world applications

          Never provide superficial coverage - users come to TrendBits for deep, expert-level analysis they can't get elsewhere.

          Output format: Pure JSON only, following the exact schema provided.
        `,
      },
    });

    // Use util to parse, validate, and filter the Gemini response
    let structured;
    const validation = validateGeminiSummary(response.text);
    if (validation.success) {
      structured = filterGeminiSummarySections(validation.data);
    } else {
      res.status(500).json(
        error({
          title: "AI Summary Error",
          message:
            "Sorry, we couldn't generate a summary at this time. Please try again later or contact support.",
        })
      );
      return;
    }

    // Save to user's history if user is logged in
    if (userId && structured) {
      try {
        const db: Database = await getDatabase();
        const historyId = uuidv7();
        const now = new Date().toISOString();

        await queryWithRetry(
          () => db.sql`
            INSERT INTO trend_history (
              id, user_id, search_term, headline, summary, 
              key_points, call_to_action, created_at, updated_at
            )
            VALUES (
              ${historyId}, ${userId}, ${prompt.trim()}, ${structured.headline}, ${structured.summary},
              ${JSON.stringify(structured.key_points)}, ${structured.call_to_action}, ${now}, ${now}
            )
          `
        );

        console.log(`Saved trend summary to history for user ${userId}`);
      } catch (historyError) {
        // Log the error but don't fail the main request
        console.error("Failed to save to history:", historyError);
      }
    }

    res.json(
      success({
        title: "AI Trend Summary",
        message: "Successfully generated structured summary",
        data: {
          ...structured,
          searchTerm: prompt,
          saved_to_history: !!userId, // Indicate if it was saved to history
        },
      })
    );
  } catch (err) {
    console.error("Gemini AI summary error:", err);
    res.status(500).json(
      error({
        title: "Internal Server Error",
        message: "Failed to generate AI summary",
      })
    );
  }
};
