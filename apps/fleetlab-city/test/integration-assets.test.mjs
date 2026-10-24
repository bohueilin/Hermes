import test from 'node:test';
import assert from 'node:assert/strict';
import * as integration from '../deploy/integration-assets.mjs';
import {buildSite} from '../../../playground/fleetlab/tools/pack.mjs';
import {fileURLToPath} from 'node:url';
import {DEPOT_PAGE} from '../../../playground/fleetlab/tools/depot-lab-package.mjs';

test('only the verified source archive receives download headers',()=>{
 const source='network-flows/sources/'+'a'.repeat(64)+'.json.gz';
 const files=new Map([['index.html','<html><head><link rel="stylesheet" href="./styles.css"></head><body><div id="fleetlab-teaching-strip"></div></body></html>'],['boot.js','export const boot = true;'],['_headers','/*\n  X-Frame-Options: DENY\n']]);
 const headers=integration.integratedRootFiles(files,{source}).get('_headers');
 assert.ok(headers.includes(`\n/${source}\n\tContent-Type: application/gzip\n`));
 assert.ok(headers.includes('Content-Disposition: attachment; filename="fleetlab-teaching-source.json.gz"'));
 assert.ok(headers.includes('Cache-Control: public, max-age=31536000, immutable'));
 assert.ok(!headers.includes('/network-flows/sources/*'));
 assert.ok(!integration.integratedRootFiles(files).get('_headers').includes('/network-flows/sources/'));
 for(const invalid of ['network-flows/sources/*',source+'\n/*', '../'+source]){
  assert.throws(()=>integration.integratedRootFiles(files,{source:invalid}),/source.*path/i);
 }
});

test('integrated root caps powerful features once and City inherits the same policy',()=>{
 const permission='camera=(), microphone=(), geolocation=(), payment=(), usb=()';
 for(const previous of ['', '  Permissions-Policy: geolocation=()\n', `  Permissions-Policy: ${permission}\n`]){
  const files=new Map([['index.html','<html><head><link rel="stylesheet" href="./styles.css"></head><body><div id="fleetlab-teaching-strip"></div></body></html>'],['boot.js','export const boot = true;'],['_headers',`/*\n  X-Frame-Options: DENY\n${previous}`]]);
  const headers=integration.integratedRootFiles(files).get('_headers');
  const [root,city]=headers.split('\n/city-explorer/*');
  assert.ok(root.includes(`\tPermissions-Policy: ${permission}\n`));
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

test('the hosted depot page carries no Google tag while every other teaching page keeps it',()=>{
 const teaching=buildSite(fileURLToPath(new URL('../../../playground/fleetlab/',import.meta.url)));
 assert.ok(teaching.has(DEPOT_PAGE));
 const result=integration.integratedRootFiles(teaching,{branded:true,rollback:'city-explorer/releases/0000000000000000'});
 const tag=/googletagmanager\.com|gtag\(|dataLayer/;
 const depot=result.get(DEPOT_PAGE);
 assert.doesNotMatch(depot,tag);
 assert.match(depot,/<script type="module" src="\/brand\.mjs"><\/script>/);
 assert.doesNotMatch(depot.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1],/google/);
 const others=[...teaching.keys()].filter(path=>path.endsWith('.html')&&path!==DEPOT_PAGE);
 assert.ok(others.length>=6);
 for(const path of others)assert.match(result.get(path),/googletagmanager\.com\/gtag\/js\?id=G-04EZ8EZWQ2/,path);
});
