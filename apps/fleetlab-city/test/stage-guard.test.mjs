import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyStage,releaseCommand} from '../deploy/stage-guard.mjs';
test('aliases and global options cannot redirect or bypass a guarded upload',()=>{
 const valid=['pages','deploy','build/site','--project-name','fleetlab','--branch','codex-city-explorer'];
 assert.equal(releaseCommand(valid),'deploy');
 for(const invalid of [ ['pages','publish',...valid.slice(2)], ['pages','deployment','create',...valid.slice(2)], ['--cwd','elsewhere',...valid], [...valid,'--cwd','elsewhere'], [...valid,'--config','other.toml'], [...valid,'--project-name','other'], [...valid.slice(0,6),'other'], ['pages','deploy'] ])assert.throws(()=>releaseCommand(invalid),/Unsupported/);
 assert.equal(releaseCommand(['--version']),'version');assert.equal(releaseCommand(['pages','deployment','list','--project-name','fleetlab','--json']),'list');
});
test('release guard rejects byte changes, extra files, wrong commits and links',()=>{
 const root=mkdtempSync(join(tmpdir(),'fleetlab-release-test-'));
 try{
  const site=join(root,'site');mkdirSync(site);mkdirSync(join(root,'review'));
  const data=JSON.stringify({source_commit:'example'});writeFileSync(join(site,'publication.json'),data);
  writeFileSync(join(root,'review/integration-manifest.json'),JSON.stringify({files:{'publication.json':{bytes:Buffer.byteLength(data),sha256:createHash('sha256').update(data).digest('hex')}}}));
  assert.equal(verifyStage(site,'example'),1);assert.throws(()=>verifyStage(site,'other'),/commit/);
  writeFileSync(join(site,'publication.json'),data+' ');assert.throws(()=>verifyStage(site,'example'),/bytes/);
  writeFileSync(join(site,'publication.json'),data);writeFileSync(join(site,'extra'),'unreviewed');assert.throws(()=>verifyStage(site,'example'),/inventory/);
  rmSync(join(site,'extra'));symlinkSync(join(site,'publication.json'),join(site,'linked'));assert.throws(()=>verifyStage(site,'example'),/Linked/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
