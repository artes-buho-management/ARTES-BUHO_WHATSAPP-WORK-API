import assert from "node:assert/strict";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFirstTextMessage } from "../src/app.js";
import { config, isGeminiReady } from "../src/config.js";
import { MessageDedupeStore } from "../src/dedupe.js";
import { generateGeminiReply } from "../src/gemini.js";
import { verifyMetaSignature } from "../src/security.js";
import { checkWhatsAppToken } from "../src/whatsapp.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const reportsDir = path.join(rootDir, "reports");

const report = {
  generatedAt: new Date().toISOString(),
  project: "whatsapp-work-api",
  checks: [],
  manualActions: []
};

function addCheck(name, status, severity, details) {
  report.checks.push({ name, status, severity, details });
}

function addManualAction(action) {
  if (!report.manualActions.includes(action)) {
    report.manualActions.push(action);
  }
}

function runInlineUnitChecks() {
  try {
    const body = Buffer.from(JSON.stringify({ ok: true }));
    const appSecret = "REPLACE_WITH_TEST_SECRET";
    const digest = crypto.createHmac("sha256", appSecret).update(body).digest("hex");

    const valid = verifyMetaSignature({
      rawBody: body,
      signatureHeader: `sha256=${digest}`,
      appSecret
    });
    assert.equal(valid.ok, true);

    const invalid = verifyMetaSignature({
      rawBody: body,
      signatureHeader: "sha256=deadbeef",
      appSecret
    });
    assert.equal(invalid.ok, false);

    const malformed = verifyMetaSignature({
      rawBody: body,
      signatureHeader: "bad-format",
      appSecret
    });
    assert.equal(malformed.ok, false);

    const dedupe = new MessageDedupeStore(1000);
    assert.equal(dedupe.seen("mid-1"), false);
    assert.equal(dedupe.seen("mid-1"), true);

    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "mid.1",
                    from: "34600111222",
                    type: "text",
                    text: { body: "Hola" }
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const parsed = extractFirstTextMessage(payload);
    assert.equal(parsed.id, "mid.1");
    assert.equal(parsed.from, "34600111222");
    assert.equal(parsed.text, "Hola");

    return { ok: true, details: "Inline unit checks OK (security + dedupe + parsing)." };
  } catch (error) {
    return { ok: false, details: error.message };
  }
}

async function collectProjectFiles(dir, acc = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, fullPath);

    if (entry.isDirectory()) {
      if (["node_modules", ".git", "reports"].includes(entry.name)) {
        continue;
      }
      await collectProjectFiles(fullPath, acc);
      continue;
    }

    if ([".env", "package-lock.json"].includes(entry.name)) {
      continue;
    }

    acc.push(relativePath);
  }

  return acc;
}

async function scanFilesForSecrets() {
  const files = await collectProjectFiles(rootDir);
  const findings = [];

  const patterns = [
    { name: "Gemini key", regex: /AIza[0-9A-Za-z_\-]{20,}/ },
    { name: "Meta token", regex: /EA[A-Za-z0-9]{60,}/ }
  ];

  for (const relativeFile of files) {
    const fullPath = path.join(rootDir, relativeFile);
    let content = "";

    try {
      content = await fs.readFile(fullPath, "utf8");
    } catch {
      continue;
    }

    for (const pattern of patterns) {
      if (pattern.regex.test(content)) {
        findings.push(`${pattern.name} en ${relativeFile}`);
      }
    }
  }

  if (findings.length > 0) {
    return { ok: false, details: findings.join("; ") };
  }

  return { ok: true, details: "No se detectaron secretos en archivos de codigo/docs." };
}

async function main() {
  addCheck("Node version", "pass", "info", process.version);

  if (!config.metaAppSecret || config.allowUnsignedWebhook) {
    addCheck(
      "Webhook signature hardening",
      "warn",
      "high",
      "META_APP_SECRET vacio o ALLOW_UNSIGNED_WEBHOOK=true"
    );
    addManualAction("Configura META_APP_SECRET y fuerza ALLOW_UNSIGNED_WEBHOOK=false en produccion.");
  } else {
    addCheck("Webhook signature hardening", "pass", "info", "Firma de Meta obligatoria activada.");
  }

  const retryConfigOk = config.httpRetryAttempts >= 1 && config.httpRetryBaseMs >= 100;
  if (retryConfigOk) {
    addCheck(
      "HTTP retry config",
      "pass",
      "info",
      `intentos=${config.httpRetryAttempts}, baseMs=${config.httpRetryBaseMs}`
    );
  } else {
    addCheck("HTTP retry config", "warn", "medium", "Reintentos desactivados o muy bajos.");
    addManualAction("Sube HTTP_RETRY_ATTEMPTS a >=1 y HTTP_RETRY_BASE_MS a >=100.");
  }

  const testRun = runInlineUnitChecks();
  if (testRun.ok) {
    addCheck("Inline unit checks", "pass", "info", testRun.details);
  } else {
    addCheck("Inline unit checks", "fail", "high", testRun.details);
    addManualAction("Revisa la logica interna de seguridad/dedupe/parsing.");
  }

  const tokenFormatLooksValid = /^EA[A-Za-z0-9]{60,}$/.test(config.accessToken);
  if (!tokenFormatLooksValid) {
    addCheck("WhatsApp token format", "fail", "high", "Formato de token sospechoso.");
    addManualAction("Copia de nuevo el token de Meta usando el boton Copy (sin OCR).");
  } else {
    addCheck("WhatsApp token format", "pass", "info", "Formato EA... valido.");
  }

  const tokenCheck = await checkWhatsAppToken();
  if (tokenCheck.ok) {
    addCheck("WhatsApp token live check", "pass", "info", JSON.stringify(tokenCheck.data));
  } else {
    addCheck("WhatsApp token live check", "fail", "high", tokenCheck.error.message);
    addManualAction("Genera un token nuevo en Meta > WhatsApp > API Setup y actualiza WHATSAPP_ACCESS_TOKEN.");
  }

  if (isGeminiReady()) {
    try {
      const aiText = await generateGeminiReply("Responde exactamente: OK");
      addCheck("Gemini live check", "pass", "info", aiText.slice(0, 120));
    } catch (error) {
      addCheck("Gemini live check", "warn", "medium", error.message);
      addManualAction("Verifica red saliente y GEMINI_API_KEY si Gemini falla en entorno local.");
    }
  } else {
    addCheck("Gemini config", "warn", "medium", "GEMINI_API_KEY no configurada o GEMINI_ENABLED=false");
    addManualAction("Configura GEMINI_API_KEY y GEMINI_ENABLED=true.");
  }

  const secretScan = await scanFilesForSecrets();
  if (secretScan.ok) {
    addCheck("Code/docs secret scan", "pass", "info", secretScan.details);
  } else {
    addCheck("Code/docs secret scan", "fail", "high", secretScan.details);
    addManualAction("Elimina secretos de codigo/docs y rota claves expuestas.");
  }

  await fs.mkdir(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(reportsDir, `audit-${timestamp}.json`);
  const latestPath = path.join(reportsDir, "audit-latest.json");
  const reportText = JSON.stringify(report, null, 2);
  await fs.writeFile(reportPath, reportText, "utf8");
  await fs.writeFile(latestPath, reportText, "utf8");

  const failCount = report.checks.filter((c) => c.status === "fail").length;
  const warnCount = report.checks.filter((c) => c.status === "warn").length;
  const passCount = report.checks.filter((c) => c.status === "pass").length;

  console.log(`AUDIT SUMMARY -> pass=${passCount} warn=${warnCount} fail=${failCount}`);
  console.log(`REPORT -> ${reportPath}`);

  if (report.manualActions.length > 0) {
    console.log("MANUAL ACTIONS:");
    report.manualActions.forEach((action, index) => {
      console.log(`${index + 1}. ${action}`);
    });
  } else {
    console.log("MANUAL ACTIONS: none");
  }

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Audit script failed:", error.message);
  process.exitCode = 1;
});
