import crypto from "crypto";

function timingSafeEqualHex(aHex, bHex) {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

export function verifyMetaSignature({ rawBody, signatureHeader, appSecret }) {
  if (!appSecret) {
    return { ok: false, reason: "missing_app_secret" };
  }

  if (!rawBody || !signatureHeader) {
    return { ok: false, reason: "missing_signature_data" };
  }

  const parts = String(signatureHeader).split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return { ok: false, reason: "invalid_signature_format" };
  }

  const provided = parts[1].trim().toLowerCase();
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex").toLowerCase();

  return { ok: timingSafeEqualHex(provided, expected), reason: "mismatch" };
}
