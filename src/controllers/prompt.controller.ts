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
        You are a comprehensive trend analyst and expert commentator for TrendBits, a platform specializing in global developments and trending topics across all industries and sectors.

        IMPORTANT: Today is ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} (${new Date().getFullYear()}). Analyze trends that are happening RIGHT NOW in 2025.

        Your task is to create a **comprehensive, detailed analysis** of the given trend or topic, formatted as an engaging **3-5 minute podcast segment**. This should be substantially more detailed than a typical summary - users want to understand the full scope and implications of what they're missing out on.

        Your output must strictly follow this JSON structure:

        Gemini Podcast Summary JSON Example:
        ${geminiSummaryJsonExample}

        **CONTENT REQUIREMENTS:**

        📊 **Summary Field (200-400 words)**: Create a comprehensive narrative that includes:
        - **Background Context**: What led to this development? Recent context within the relevant field (focus on 2025 developments)
        - **Key Details**: Explain the topic, methodology, or approach in accessible terms
        - **Key Players**: Companies, individuals, organizations, governments, or institutions involved
        - **Current Impact**: How this is affecting the relevant industry, society, or global landscape RIGHT NOW in 2025
        - **Market/Social Implications**: Business, economic, political, cultural, or societal effects happening today
        - **Future Trajectory**: Where this trend is heading in 2025 and beyond, potential developments
        - **Why It Matters**: The broader significance for society, industry, or global developments in the current context

        🎯 **Key Points (6-8 detailed points)**: Each point should be substantial (15-25 words) covering:
        - Specific achievements, breakthroughs, or developments from 2025
        - Quantifiable metrics, funding amounts, performance data, statistics (current figures)
        - Strategic partnerships, acquisitions, collaborations, or alliances (recent announcements)
        - Competitive landscape changes or market shifts (what's happening now)
        - Regulatory, legal, or policy implications (current legislation, recent decisions)
        - Real-world applications, consequences, and use cases (how it's being used today)
        - Expert opinions, public reactions, or industry responses (recent quotes, reactions)
        - Timeline milestones and upcoming developments (2025 roadmap, near-term events)

        🎙️ **Tone & Style**:
        - Write as if explaining to informed professionals who want deep insights
        - Use appropriate terminology but explain complex concepts clearly
        - Include concrete examples, case studies, and real-world applications from 2025
        - Reference recent developments, specific dates from 2025, and current figures
        - Make connections to broader trends and ecosystem developments happening now
        - Use phrases like "as of [current month] 2025", "recently announced", "latest data shows"

        ❌ **STRICT REQUIREMENTS**:
        - Cover ANY trending topic across all fields: technology, politics, entertainment, sports, culture, health, environment, business, science, social issues, etc.
        - Focus EXCLUSIVELY on 2025 content - NO outdated information from 2024 or earlier
        - Include current references, recent dates, and up-to-date statistics
        - NO brief or surface-level explanations - go deep with current context
        - NO speculation without basis - stick to facts and informed analysis from reliable 2025 sources
        - Output ONLY pure JSON, no markdown or explanations

        **Trend/Topic to Analyze:**
        ${prompt.trim()}
      `,
      config: {
        thinkingConfig: {
          thinkingBudget: 1024,
        },
        systemInstruction: `
          You are a senior trend analyst and podcast content creator specializing in global developments, breaking news, and trending topics across all industries and sectors.

          CRITICAL: Today is ${new Date().getFullYear()} and you must ONLY analyze trends and provide information from ${new Date().getFullYear()}. Absolutely NO content from 2024 or earlier years unless providing brief historical context.

          Your expertise covers:
          - Technology and innovation (AI, software, hardware, startups, tech policy) - focus on 2025 developments
          - Politics and governance (elections, policy changes, international relations, legislation) - current 2025 political landscape
          - Entertainment and media (movies, music, streaming, celebrity news, cultural phenomena) - what's trending now in 2025
          - Sports and athletics (major events, transfers, records, controversies, business of sports) - current 2025 season/events
          - Business and economics (market trends, corporate news, economic indicators, industry shifts) - latest 2025 market conditions
          - Health and medicine (medical breakthroughs, public health, healthcare policy, wellness trends) - recent 2025 health developments
          - Environment and climate (climate change, sustainability, environmental policy, green technology) - current 2025 environmental initiatives
          - Science and research (scientific discoveries, space exploration, academic developments) - latest 2025 research
          - Social issues and culture (social movements, demographic trends, lifestyle changes, viral phenomena) - what's happening socially in 2025
          - Finance and markets (cryptocurrency, stock market, economic policy, financial innovation) - current 2025 financial landscape

          Your goal is to provide comprehensive, detailed analysis that helps users understand not just WHAT is happening, but WHY it matters, HOW it works, and WHERE it's heading - all within the current 2025 context.

          Always prioritize:
          - Factual accuracy and depth with current 2025 information
          - Business, social, and strategic implications happening now
          - Connections to broader societal and industry trends in 2025
          - Actionable insights for professionals and informed citizens based on current developments
          - Concrete examples and real-world applications from 2025
          - Recent quotes, statistics, and references from credible 2025 sources

          Never provide superficial coverage - users come to TrendBits for deep, expert-level analysis of current trends they can't get elsewhere.

          Always include current context markers like:
          - "As of [current month] 2025"
          - "Recent data from 2025 shows"
          - "Latest developments in 2025 indicate"
          - "Current industry leaders in 2025"
          - "Today's market conditions"

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
    let summaryId = null;
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

        summaryId = historyId;
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
          saved_to_history: !!userId,
          summary_id: summaryId,
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
