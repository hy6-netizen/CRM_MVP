import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('review engine includes hospital greeting rule', async () => {
  const content = await fs.readFile('packages/ai/src/reviewReplyEngine.ts', 'utf8');
  assert.ok(content.includes('안녕하세요~ 의성한방병원입니다.'));
});

test('compliance checker has blocked expressions', async () => {
  const content = await fs.readFile('packages/ai/src/complianceChecker.ts', 'utf8');
  assert.ok(content.includes('완치'));
  assert.ok(content.includes('국내 1위'));
});
