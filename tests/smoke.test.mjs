import test from 'node:test';
import assert from 'node:assert/strict';

test('workspace file exists', async () => {
  const fs = await import('node:fs/promises');
  const content = await fs.readFile('pnpm-workspace.yaml', 'utf8');
  assert.ok(content.includes('packages'));
});
