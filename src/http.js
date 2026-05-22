function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function shouldRetry({ status, attempt, maxAttempts, networkError }) {
  if (attempt >= maxAttempts) {
    return false;
  }

  if (networkError) {
    return true;
  }

  return status === 429 || (status >= 500 && status <= 599);
}

export async function fetchJsonWithRetry({
  url,
  method,
  headers,
  body,
  timeoutMs,
  maxAttempts,
  baseDelayMs,
  contextLabel
}) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal
      });

      const rawText = await response.text();
      const json = parseJsonSafe(rawText);

      if (response.ok) {
        return { status: response.status, data: json ?? rawText };
      }

      const error = new Error(
        `${contextLabel} error ${response.status}: ${JSON.stringify(json ?? rawText).slice(0, 2000)}`
      );
      error.status = response.status;
      error.responseBody = json ?? rawText;
      lastError = error;

      const retry = shouldRetry({
        status: response.status,
        attempt,
        maxAttempts,
        networkError: false
      });

      if (!retry) {
        throw error;
      }
    } catch (error) {
      const isAbort = error?.name === "AbortError";
      const networkError = isAbort || /fetch failed/i.test(String(error?.message || ""));

      if (!networkError) {
        throw error;
      }

      lastError = new Error(`${contextLabel} network error: ${error.message}`);

      const retry = shouldRetry({
        status: 0,
        attempt,
        maxAttempts,
        networkError: true
      });

      if (!retry) {
        throw lastError;
      }
    } finally {
      clearTimeout(timeout);
    }

    const jitter = Math.floor(Math.random() * baseDelayMs);
    const delay = baseDelayMs * attempt + jitter;
    await sleep(delay);
  }

  throw lastError || new Error(`${contextLabel} failed after retries`);
}
