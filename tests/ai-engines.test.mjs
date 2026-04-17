import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
test("review engine greeting exists", async () => {
const c = await fs.readFile("packages/ai/src/reviewReplyEngine.ts", "utf8");
assert.ok(c.includes("안녕하세요~ 의성한방병원입니다."));
});
