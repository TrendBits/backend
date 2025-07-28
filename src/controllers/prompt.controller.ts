import type { Request, Response } from "express";
import { error, success } from "../utils/api_response.util";
import { PromptRequest } from "../types/prompt.types";
import { GoogleGenAI } from "@google/genai";
import {
  geminiSummaryJsonExample,
  filterGeminiSummarySections,
  validateGeminiSummary,
} from "../utils/gemini_summary.util";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const generateSummary = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { prompt } = req.body as PromptRequest;

    if (!prompt || !prompt.trim()) {
      res.status(400).json(
        error({
          title: "Validation Error",
          message: "Please provide a trend to summarize",
        })
      );
      return;
    }

    // Use Gemini AI to generate a structured, slightly longer summary
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: `
        You are an AI assistant for a trend analysis platform called TrendBits.

        Your task is to summarize any given trend in a **narrative, engaging format** suitable for conversion into a **1–3 minute podcast segment**. Your output must strictly follow the JSON example below (all fields required):

        Gemini Podcast Summary JSON Example:
        ${geminiSummaryJsonExample}

        💡 Your tone should be intelligent yet conversational — imagine you're scripting a podcast for curious young professionals.

        ✅ Always include relevant dates, names, events, and background to explain **what is happening**, **why it's important**, and **what's next** in that field.

        ❌ DO NOT include explanations about what you’re doing or any disclaimers.
        ❌ DO NOT wrap the JSON in markdown or add comments — only pure JSON.

        Trend to summarize:
        ${prompt.trim()}
      `,
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
        systemInstruction: `
          You are a trend analyst and podcast scriptwriter for an AI-powered news product. Your audience expects concise, insightful, and engaging audio summaries about specific global or niche trends — tech, politics, culture, finance, science, etc.

          Your goal is to produce podcast-ready structured summaries based on any trend keyword or phrase. Output should ONLY be a JSON object following the schema provided.

          Keep your voice clear, confident, and human-friendly. Don't speculate unless clearly necessary. Always provide context, recent developments, and potential implications.

          Never include code, markdown, or surrounding text — only the raw JSON block.`,
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

    res.json(
      success({
        title: "AI Trend Summary",
        message: "Successfully generated structured summary",
        data: {
          ...structured,
          searchTerm: prompt,
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
