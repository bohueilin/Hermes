import test from 'node:test';
import assert from 'node:assert/strict';
import * as integration from '../deploy/integration-assets.mjs';

test('integrated root caps powerful features once and City inherits the same policy',()=>{
 const permission='camera=(), microphone=(), geolocation=(), payment=(), usb=()';
 for(const previous of ['', '  Permissions-Policy: geolocation=()\n', `  Permissions-Policy: ${permission}\n`]){
  const files=new Map([['index.html','<html><head><link rel="stylesheet" href="./styles.css"></head><body><div id="fleetlab-teaching-strip"></div></body></html>'],['boot.js','export const boot = true;'],['_headers',`/*\n  X-Frame-Options: DENY\n${previous}`]]);
  const headers=integration.integratedRootFiles(files).get('_headers');
  const [root,city]=headers.split('\n/city-explorer/*');
  assert.ok(root.includes(`  Permissions-Policy: ${permission}\n`));
  assert.equal((headers.match(/Permissions-Policy:/g)||[]).length,1);
  assert.ok(!city.includes('Permissions-Policy'));
  assert.ok(root.includes('X-Frame-Options: DENY'));
 }
});

test('hosted root discovery stays absent without a verified route and rejects a forged marker source',()=>{
  assert.equal(typeof integration.integratedRootFiles,'function','conditional verified root transform is missing');
  const files=new Map([['index.html','<html><head><link rel="stylesheet" href="./styles.css"></head><body><div id="fleetlab-teaching-strip"></div></body></html>'],['boot.js','export const boot = true;'],['_headers','/*\n  Content-Security-Policy: none\n']]);
  assert.doesNotMatch(integration.integratedRootFiles(files).get('index.html'),/fleetlab-software-delivery/);
  files.set('network-flows/software-delivery/release.json','{}');
  assert.throws(()=>integration.integratedRootFiles(files),/software.delivery|NF04|sidecar/);
});
