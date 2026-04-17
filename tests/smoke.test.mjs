import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
test("workspace file exists", async () => {
const content = await fs.readFile("pnpm-workspace.yaml", "utf8");
assert.ok(content.includes("packages"));
});
