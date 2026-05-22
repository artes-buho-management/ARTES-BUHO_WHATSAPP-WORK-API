import { sendTemplateHelloWorld } from "../src/whatsapp.js";

function normalizePhone(input) {
  return String(input || "").replace(/\D/g, "");
}

const rawTo = process.argv[2];
const to = normalizePhone(rawTo);

if (!to) {
  console.error("Uso: npm run send:hello-world -- <numero_en_formato_E164>");
  process.exitCode = 1;
} else {
  try {
    const result = await sendTemplateHelloWorld({ to });
    console.log("Plantilla enviada:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
