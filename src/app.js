import express from "express";
import { config, isGeminiReady } from "./config.js";
import { MessageDedupeStore } from "./dedupe.js";
import { generateGeminiReply } from "./gemini.js";
import { logError, logInfo, logWarn } from "./logger.js";
import { verifyMetaSignature } from "./security.js";
import { sendTextMessage } from "./whatsapp.js";

const dedupe = new MessageDedupeStore(config.dedupeTtlMs);

export function extractFirstTextMessage(payload) {
  const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message || message.type !== "text") {
    return null;
  }

  const text = (message.text?.body || "").trim();
  if (!text) {
    return null;
  }

  return {
    id: message.id || "",
    from: message.from || "",
    text
  };
}

function truncate(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 1)}...`;
}

export function createApp() {
  const app = express();

  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buffer) => {
        req.rawBody = Buffer.from(buffer);
      }
    })
  );

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      at: new Date().toISOString(),
      geminiReady: isGeminiReady(),
      version: config.apiVersion
    });
  });

  app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === config.verifyToken) {
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  });

  app.post("/webhook", async (req, res) => {
    const startedAt = Date.now();

    try {
      if (config.metaAppSecret) {
        const signature = req.headers["x-hub-signature-256"] || "";
        const result = verifyMetaSignature({
          rawBody: req.rawBody,
          signatureHeader: signature,
          appSecret: config.metaAppSecret
        });

        if (!result.ok) {
          logWarn("Webhook blocked: invalid meta signature", result.reason);
          return res.sendStatus(403);
        }
      } else if (!config.allowUnsignedWebhook) {
        logWarn("Webhook blocked: META_APP_SECRET missing and ALLOW_UNSIGNED_WEBHOOK is false");
        return res.sendStatus(403);
      }

      if (config.logWebhookPayload) {
        logInfo("Webhook payload", JSON.stringify(req.body));
      }

      const incoming = extractFirstTextMessage(req.body);
      if (!incoming) {
        return res.sendStatus(200);
      }

      if (dedupe.seen(incoming.id)) {
        logInfo("Duplicate webhook ignored", incoming.id);
        return res.sendStatus(200);
      }

      const normalizedText = incoming.text.toLowerCase();
      let responseText = "Recibido. Si quieres IA, escribe: /gemini tu pregunta";

      if (normalizedText === "hola") {
        responseText = "Hola. Tu integracion de WhatsApp API ya esta funcionando.";
      } else if (normalizedText.startsWith("/gemini")) {
        const prompt = incoming.text.replace(/^\/gemini\s*/i, "").trim();

        if (!prompt) {
          responseText = "Escribe /gemini seguido de tu pregunta.";
        } else if (!isGeminiReady()) {
          responseText = "Gemini no esta configurado aun en el servidor.";
        } else {
          try {
            const aiText = await generateGeminiReply(prompt);
            responseText = truncate(aiText, 1000);
          } catch (error) {
            logError("Gemini request failed", error.message);
            responseText = "No he podido consultar Gemini ahora. Intentalo de nuevo en unos minutos.";
          }
        }
      }

      if (!incoming.from) {
        logWarn("Incoming message has no sender phone");
        return res.sendStatus(200);
      }

      await sendTextMessage({ to: incoming.from, body: responseText });
      return res.sendStatus(200);
    } catch (error) {
      // Return 200 to avoid endless Meta retries in case of transient processing errors.
      logError("Webhook handler failed", error.message);
      return res.sendStatus(200);
    } finally {
      logInfo("Webhook handled in ms", Date.now() - startedAt);
    }
  });

  return app;
}
