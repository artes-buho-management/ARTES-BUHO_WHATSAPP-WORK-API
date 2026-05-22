import assert from "node:assert/strict";
import test from "node:test";
import { MessageDedupeStore } from "../src/dedupe.js";

test("MessageDedupeStore marks repeated message IDs as duplicates", () => {
  const store = new MessageDedupeStore(60000);
  assert.equal(store.seen("abc"), false);
  assert.equal(store.seen("abc"), true);
  assert.equal(store.seen("def"), false);
});

test("MessageDedupeStore expires entries after TTL", async () => {
  const store = new MessageDedupeStore(20);
  assert.equal(store.seen("abc"), false);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(store.seen("abc"), false);
});
