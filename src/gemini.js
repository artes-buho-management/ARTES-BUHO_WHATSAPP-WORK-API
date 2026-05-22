import { config, isGeminiReady } from "./config.js";
import { fetchJsonWithRetry } from "./http.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function buildGeminiUrl() {
  const model = encodeURIComponent(config.geminiModel);
  const key = encodeURIComponent(config.geminiApiKey);
  return `${GEMINI_BASE}/${model}:generateContent?key=${key}`;
}

function extractCandidateText(data) {
  return data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("\n")
    .trim();
}

export async function generateGeminiReply(userPrompt) {
  if (!isGeminiReady()) {
    throw new Error("Gemini is not configured. Set GEMINI_API_KEY and enable GEMINI_ENABLED.");
  }

  const payload = {
    system_instruction: {
      parts: [{ text: config.geminiSystemPrompt }]
    },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: config.geminiMaxOutputTokens
    }
  };

  const result = await fetchJsonWithRetry({
    url: buildGeminiUrl(),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    timeoutMs: config.requestTimeoutMs,
    maxAttempts: config.httpRetryAttempts,
    baseDelayMs: config.httpRetryBaseMs,
    contextLabel: "Gemini API"
  });

  const text = extractCandidateText(result.data);

  if (!text) {
    const finishReason = result?.data?.candidates?.[0]?.finishReason || "UNKNOWN";
    throw new Error(
      `Gemini response without text (finishReason=${finishReason}). Increase GEMINI_MAX_OUTPUT_TOKENS if needed.`
    );
  }

  return text;
}
