import "dotenv/config";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export const config = {
  port: asNumber(process.env.PORT, 3000),
  verifyToken: requireEnv("WHATSAPP_VERIFY_TOKEN"),
  accessToken: requireEnv("WHATSAPP_ACCESS_TOKEN"),
  phoneNumberId: requireEnv("WHATSAPP_PHONE_NUMBER_ID"),
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
  apiVersion: process.env.WHATSAPP_API_VERSION || "v22.0",
  requestTimeoutMs: asNumber(process.env.REQUEST_TIMEOUT_MS, 15000),
  httpRetryAttempts: asNumber(process.env.HTTP_RETRY_ATTEMPTS, 2),
  httpRetryBaseMs: asNumber(process.env.HTTP_RETRY_BASE_MS, 300),
  dedupeTtlMs: asNumber(process.env.DEDUPE_TTL_MS, 600000),
  metaAppSecret: process.env.META_APP_SECRET || "",
  allowUnsignedWebhook: asBoolean(process.env.ALLOW_UNSIGNED_WEBHOOK, true),
  logWebhookPayload: asBoolean(process.env.LOG_WEBHOOK_PAYLOAD, false),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-pro",
  geminiEnabled: asBoolean(process.env.GEMINI_ENABLED, true),
  geminiMaxOutputTokens: asNumber(process.env.GEMINI_MAX_OUTPUT_TOKENS, 2048),
  geminiSystemPrompt:
    process.env.GEMINI_SYSTEM_PROMPT ||
    "Eres un asistente profesional para soporte de clientes por WhatsApp. Responde claro, breve y con tono amable.",
  maxInboundChars: asNumber(process.env.MAX_INBOUND_CHARS, 4000)
};

export function isGeminiReady() {
  return Boolean(config.geminiEnabled && config.geminiApiKey);
}
