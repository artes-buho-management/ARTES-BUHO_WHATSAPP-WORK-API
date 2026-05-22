import { sendTextMessage } from "../src/whatsapp.js";

function normalizePhone(input) {
  return String(input || "").replace(/\D/g, "");
}

const rawTo = process.argv[2];
const to = normalizePhone(rawTo);
const body = process.argv.slice(3).join(" ") || "Mensaje de prueba desde WhatsApp Cloud API";

if (!to) {
  console.error("Uso: npm run send:test -- <numero_en_formato_E164> [mensaje]");
  process.exitCode = 1;
} else {
  try {
    const result = await sendTextMessage({ to, body });
    console.log("Mensaje enviado:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
