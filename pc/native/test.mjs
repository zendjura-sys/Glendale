// Перевірка ядра так, як його викликає Electron Main (cargo test не лінкується поза Node через символи N-API).
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const core = createRequire(import.meta.url)('./index.js');
const dir = mkdtempSync(join(tmpdir(), 'gc-store-'));
const store = new core.Store(dir);
store.setMode('widgets');
store.saveWindow('chat', { x: 10, y: 20, width: 300, height: 400, alwaysOnTop: true, visible: true });
store.set('session', { user: 1 });
const again = new core.Store(dir);
assert.equal(again.mode, 'widgets');
assert.equal(again.window('chat').x, 10);
assert.equal(again.get('session').user, 1);
assert.throws(() => store.setMode('bad'));
const area = { x: 0, y: 0, width: 1920, height: 1040 };
const near = { x: 400, y: 300, width: 300, height: 200 };
assert.deepEqual(core.snap({ x: 7, y: 300, width: 300, height: 200 }, [area], [], 12, 8), { x: 0, y: 300, width: 300, height: 200 });
assert.deepEqual(core.snap({ x: 706, y: 310, width: 300, height: 200 }, [area], [near], 12, 8), { x: 708, y: 300, width: 300, height: 200 });
assert.deepEqual(core.snap({ x: 900, y: 500, width: 300, height: 200 }, [area], [near], 12, 8), { x: 900, y: 500, width: 300, height: 200 });
rmSync(dir, { recursive: true, force: true });
console.log('native core: ok');
