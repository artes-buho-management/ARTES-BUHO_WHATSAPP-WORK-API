import assert from "node:assert/strict";
import crypto from "crypto";
import test from "node:test";
import { verifyMetaSignature } from "../src/security.js";

test("verifyMetaSignature accepts a valid signature", () => {
  const body = Buffer.from(JSON.stringify({ ok: true }));
  const appSecret = "REPLACE_WITH_TEST_SECRET";
  const digest = crypto.createHmac("sha256", appSecret).update(body).digest("hex");
  const signatureHeader = `sha256=${digest}`;

  const result = verifyMetaSignature({
    rawBody: body,
    signatureHeader,
    appSecret
  });

  assert.equal(result.ok, true);
});

test("verifyMetaSignature rejects invalid signature", () => {
  const body = Buffer.from("hello");
  const result = verifyMetaSignature({
    rawBody: body,
    signatureHeader: "sha256=deadbeef",
    appSecret: "REPLACE_WITH_TEST_SECRET"
  });

  assert.equal(result.ok, false);
});

test("verifyMetaSignature rejects malformed header", () => {
  const result = verifyMetaSignature({
    rawBody: Buffer.from("test"),
    signatureHeader: "bad-format",
    appSecret: "REPLACE_WITH_TEST_SECRET"
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_signature_format");
});
