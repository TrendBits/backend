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
    const currentYear = new Date().getFullYear();
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: `
        You are a senior trend analyst and expert commentator for TrendBits, specializing in identifying and analyzing **the most recent and breaking trends** across all industries and sectors.

        IMPORTANT: Today is ${currentDate} (${currentYear}).  
        - Prioritize developments from **the last 7 days and max of 14 days** whenever possible.  
        - If fewer than 14 days of context exists for a trend, expand only as far back as **the last 30 days**.  
        - Mention dates explicitly in the narrative to signal recency.  
        - Do not rely on outdated reports or articles older than ${currentYear}.  
        - All references must be **published within ${currentYear}**, ideally the current month ${currentMonth}.

        Your task: produce a **3–5 minute podcast-style analysis** in JSON format, output must strictly follow the structure:
        ${geminiSummaryJsonExample}

        **CONTENT RULES:**
        - Summary: 200–400 words, markdown-formatted, covering:
          ## Background Context – ONLY recent background from this year ${currentYear} (brief history if needed)
          ## Key Details – clear explanation of the trend
          ## Key Players – people, companies, orgs, governments, or institutions currently active in this trend
          ## Current Impact – what is happening RIGHT NOW? How this is affecting the relevant industry, society, or global landscape in ${currentYear}
          ## Market/Social Implications – immediate effects on businesses, economics, politics, cultures, or society today
          ## Future Trajectory – where it’s heading in the near term
          ## Why It Matters – importance in today’s context

      - Tone: authoritative yet accessible, for informed professionals
      - No greetings, no platform acknowledgments, no fluff
      - All factual claims must be supported by references (in the references array ONLY, not inline)
      - References:  
        * Real URLs from grounded search only  
        * All from reputable sources (BBC, Reuters, AP, official sites, etc.)  
        * All from the last 90 days (preferably last 30)  
        * No fabricated links  
        * Include: title, url, source, date (YYYY-MM-DD)

      - Key Points: 6–8 detailed, fact-rich bullets, all tied to **recent ${currentYear} events**

      **Strict Instructions for Recency:**
      - Avoid general overviews that ignore the latest data/events.
      - Include phrases like "as of ${currentMonth} ${currentYear}", "in the past week", "recently announced".
      - Highlight concrete, timestamped developments from grounded search results.
      - If no recent info exists, say so in the summary rather than padding with old content.
        ${prompt.trim()}
      `,
      config: {
        thinkingConfig: {
          thinkingBudget: 1024,
        },
        systemInstruction: `
          You are a senior trend analyst and podcast content creator specializing in global developments, breaking news, and trending topics across all industries and sectors.

          CRITICAL: Today is ${currentYear} and you must ONLY analyze trends and provide information from ${currentYear}. Absolutely NO content from ${currentYear - 1} or earlier years unless providing brief historical context.

          Your expertise covers:
          - Technology and innovation (AI, software, hardware, startups, tech policy) - focus on ${currentYear} developments
          - Politics and governance (elections, policy changes, international relations, legislation) - current ${currentYear} political landscape
          - Entertainment and media (movies, music, streaming, celebrity news, cultural phenomena) - what's trending now in ${currentYear}
          - Sports and athletics (major events, transfers, records, controversies, business of sports) - current ${currentYear} season/events
          - Business and economics (market trends, corporate news, economic indicators, industry shifts) - latest ${currentYear} market conditions
          - Health and medicine (medical breakthroughs, public health, healthcare policy, wellness trends) - recent ${currentYear} health developments
          - Environment and climate (climate change, sustainability, environmental policy, green technology) - current ${currentYear} environmental initiatives
          - Science and research (scientific discoveries, space exploration, academic developments) - latest ${currentYear} research
          - Social issues and culture (social movements, demographic trends, lifestyle changes, viral phenomena) - what's happening socially in ${currentYear}
          - Finance and markets (cryptocurrency, stock market, economic policy, financial innovation) - current ${currentYear} financial landscape

          Your goal is to provide comprehensive, detailed analysis that helps users understand not just WHAT is happening, but WHY it matters, HOW it works, and WHERE it's heading - all within the current ${currentYear} context.

          Always prioritize:
          - Factual accuracy and depth with current ${currentYear} information
          - Business, social, and strategic implications happening now
          - Connections to broader societal and industry trends in ${currentYear}
          - Actionable insights for professionals and informed citizens based on current developments
          - Concrete examples and real-world applications from ${currentYear}
          - Recent quotes, statistics, and references from credible ${currentYear} sources

          Never provide superficial coverage - users come to TrendBits for deep, expert-level analysis of current trends they can't get elsewhere.

          Always include current context markers like:
          - "As of ${currentMonth} ${currentYear}"
          - "Recent data from ${currentYear} shows"
          - "Latest developments in ${currentYear} indicate"
          - "Current industry leaders in ${currentYear}"
          - "Today's market conditions"

          IMPORTANT: When generating the summary field, format it as proper markdown with headers (##) and structured sections to make it visually appealing and easy to read. The summary should be well-organized with clear sections rather than a plain text block.

          CRITICAL FORMATTING RULES:
          - DO NOT include any greetings, welcomes, or introductory phrases like "Welcome back to TrendBits", "Hello", or similar
          - Start directly with the trend analysis content
          - No platform-specific acknowledgments or greetings
          - Focus purely on the substantive content and analysis
          - ABSOLUTELY NO inline references, citations, or source mentions in the summary or key_points text
          - The summary and key_points must be completely clean of any reference indicators like [1], [2], (Source: ...), etc.
          - Write the summary as if you're speaking naturally without citing sources in the text
          - ALL sources must ONLY appear in the "references" array field
          - DO NOT generate fake URLs - only use real, accessible URLs that you can verify
          - If you cannot find real URLs, leave the references array empty rather than creating fake ones
          - Each reference (if any) must include: title, url (REAL working link), source, and date
          - Only use reputable news sources like BBC, Reuters, CNN, Associated Press, official government sites, etc.
          - Test URLs mentally - they should follow real website patterns (e.g., bbc.com/news/..., reuters.com/...)
          - The summary should flow naturally as pure narrative content without any source interruptions

          IMPORTANT: Write the summary as if you're telling a story or giving a presentation - no citations, no references, just pure informative content. All sources go separately in the references field.

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
              key_points, call_to_action, article_references, created_at, updated_at
            )
            VALUES (
              ${historyId}, ${userId}, ${prompt.trim()}, ${structured.headline}, ${structured.summary},
              ${JSON.stringify(structured.key_points)}, ${structured.call_to_action}, ${JSON.stringify(structured.references || [])}, ${now}, ${now}
            )
          `,
        );

        summaryId = historyId;
        console.log(`Saved trend summary to history for user ${userId}`);
      } catch (historyError) {
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
