import { generateGeminiReply } from "../src/gemini.js";

const prompt = process.argv.slice(2).join(" ") || "Resumeme en 3 puntos que hace una API de WhatsApp Business.";

try {
  const text = await generateGeminiReply(prompt);
  console.log("Respuesta Gemini:\n");
  console.log(text);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
