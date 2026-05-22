import { createApp } from "./app.js";
import { config } from "./config.js";
import { logInfo } from "./logger.js";

const app = createApp();

app.listen(config.port, () => {
  logInfo(`WhatsApp webhook server listening on http://localhost:${config.port}`);
});
