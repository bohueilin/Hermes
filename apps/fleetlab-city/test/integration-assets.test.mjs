import test from 'node:test';
import assert from 'node:assert/strict';
import * as integration from '../deploy/integration-assets.mjs';

test('hosted root discovery stays absent without a verified route and rejects a forged marker source',()=>{
  assert.equal(typeof integration.integratedRootFiles,'function','conditional verified root transform is missing');
  const files=new Map([['index.html','<html><head><link rel="stylesheet" href="./styles.css"></head><body><div id="fleetlab-teaching-strip"></div></body></html>'],['boot.js','export const boot = true;'],['_headers','/*\n  Content-Security-Policy: none\n']]);
  assert.doesNotMatch(integration.integratedRootFiles(files).get('index.html'),/fleetlab-software-delivery/);
  files.set('network-flows/software-delivery/release.json','{}');
  assert.throws(()=>integration.integratedRootFiles(files),/software.delivery|NF04|sidecar/);
});
