import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import * as guard from '../deploy/stage-guard.mjs';

test('release tooling refuses Node versions without the eMudhra TLS fix', () => {
  for (const version of ['22.0.0', '22.22.0', '22.23.3', '20.20.0', '24.22.1', '22.23.4-rc.1', 'unknown']) {
    assert.throws(() => guard.verifyReleaseRuntime(version), /Node 22\.23\.4/);
  }
});

test('release tooling accepts patched versions within the qualified Node 22 line', () => {
  for (const version of ['22.23.4', '22.23.5', '22.24.0']) {
    assert.doesNotThrow(() => guard.verifyReleaseRuntime(version));
  }
});

test('the launcher checks its runtime before processing arguments or loading Wrangler', () => {
  const wrapper = new URL('../deploy/wrangler.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `Object.defineProperty(process.versions, 'node', {value: '22.22.0'}); await import(${JSON.stringify(wrapper)});`],
  {encoding: 'utf8'});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Node 22\.23\.4/);
  assert.doesNotMatch(result.stderr, /Unsupported release command|Unexpected Wrangler CLI/);
});
