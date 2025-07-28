import { z } from "zod";

// Zod schema for Gemini AI podcast summary response
export const geminiSummarySchema = z.object({
  headline: z.string().min(1, "Headline is required"),
  summary: z.string().min(1, "Summary is required"),
  key_points: z.array(z.string()).min(1, "At least one key point is required"),
  call_to_action: z.string().min(1, "Call to action is required"),
});

// Export a stringified JSON example for prompt injection
export const geminiSummaryJsonExample = JSON.stringify(
  {
    headline:
      "A short, compelling headline that captures the essence of the trend.",
    summary:
      "A podcast-style spoken summary of 10–15 sentences. It should be narrative, informative, and naturally flowing. Start with a hook or intro, provide background or current context, highlight major points, and conclude smoothly.",
    key_points: [
      "Bullet-point list of 4–6 key facts, developments, stats, or takeaways related to the trend.",
    ],
    call_to_action:
      "A short, friendly wrap-up that invites the listener to stay informed, take action, or check back later.",
  },
  null,
  2
);

// Helper to clean and parse JSON from Gemini (removes code block markers, trims, etc)
export function parseGeminiJsonBlock(text: string): any | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// Validate Gemini summary response
export function validateGeminiSummary(data: any) {
  try {
    // Try to parse as JSON first if it's a string
    const parsedData =
      typeof data === "string" ? parseGeminiJsonBlock(data) : data;
    const result = geminiSummarySchema.safeParse(parsedData);
    console.log(result);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error.format() };
  } catch {
    return { success: false, errors: { _errors: ["Invalid JSON format"] } };
  }
}

// Utility to extract and filter Gemini summary sections
export function filterGeminiSummarySections(data: any) {
  // Accepts either a string (JSON) or object
  const parsed = typeof data === "string" ? parseGeminiJsonBlock(data) : data;
  if (!parsed || typeof parsed !== "object") return null;
  return {
    headline: parsed.headline || "",
    summary: parsed.summary || "",
    key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
    call_to_action: parsed.call_to_action || "",
  };
}
