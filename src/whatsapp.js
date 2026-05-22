import { config } from "./config.js";
import { fetchJsonWithRetry } from "./http.js";

const graphBase = `https://graph.facebook.com/${config.apiVersion}`;
const messagesUrl = `${graphBase}/${config.phoneNumberId}/messages`;

function assertE164(number) {
  if (!/^\d{6,15}$/.test(number)) {
    throw new Error("Invalid destination number. Use E.164 digits only, without + or separators.");
  }
}

function normalizeWhatsAppError(error) {
  const payload = error?.responseBody || {};
  const code = payload?.error?.code;

  if (code === 190) {
    return new Error(
      "WhatsApp token invalido o malformado (OAuth 190). Genera un token nuevo en Meta > WhatsApp > API Setup."
    );
  }

  return error;
}

async function callWhatsAppApi(payload) {
  try {
    const result = await fetchJsonWithRetry({
      url: messagesUrl,
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      timeoutMs: config.requestTimeoutMs,
      maxAttempts: config.httpRetryAttempts,
      baseDelayMs: config.httpRetryBaseMs,
      contextLabel: "WhatsApp API"
    });

    return result.data;
  } catch (error) {
    throw normalizeWhatsAppError(error);
  }
}

export async function checkWhatsAppToken() {
  try {
    const result = await fetchJsonWithRetry({
      url: `${graphBase}/me?access_token=${encodeURIComponent(config.accessToken)}`,
      method: "GET",
      timeoutMs: config.requestTimeoutMs,
      maxAttempts: 1,
      baseDelayMs: config.httpRetryBaseMs,
      contextLabel: "WhatsApp token check"
    });

    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: normalizeWhatsAppError(error) };
  }
}

export async function sendTextMessage({ to, body }) {
  assertE164(to);

  const cleanBody = String(body || "").trim();
  if (!cleanBody) {
    throw new Error("Message body cannot be empty.");
  }

  return callWhatsAppApi({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: cleanBody, preview_url: false }
  });
}

export async function sendTemplateHelloWorld({ to, languageCode = "en_US" }) {
  assertE164(to);

  return callWhatsAppApi({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: "hello_world",
      language: { code: languageCode }
    }
  });
}
