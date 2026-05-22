import assert from "node:assert/strict";
import test from "node:test";
import { extractFirstTextMessage } from "../src/app.js";

test("extractFirstTextMessage returns parsed text message", () => {
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
});

test("extractFirstTextMessage ignores non-text payloads", () => {
  const payload = { entry: [] };
  const parsed = extractFirstTextMessage(payload);
  assert.equal(parsed, null);
});
