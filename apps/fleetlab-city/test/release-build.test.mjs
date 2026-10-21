import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../../../playground/fleetlab/tools/pack.mjs';
import {stageFixture,writeFiles,inventory,fingerprint} from './stage-fixture.mjs';

test('local release recipe reproduces the complete stage and rejects unsafe inputs without partial output',()=>{
 assert.ok(existsSync(fileURLToPath(new URL('../deploy/build-release.py',import.meta.url))),'tracked release recipe is required');
 const f=stageFixture({gzipCity:true});
 try{
  const recipe=join(f.source,'apps/fleetlab-city/deploy/build-release.py'),legacy=join(f.root,'legacy'),readback=join(f.root,'legacy-readback.json');
  const sets=JSON.parse(execFileSync('python3',['-B','-c',
   "import json,runpy,sys; m=runpy.run_path(sys.argv[1]); print(json.dumps({'added':sorted(set().union(*(m[k] for k in ['FLOW_ADDED','CAPACITY_ADDED','DELIVERY_ADDED','ORDER_ADDED','R1_ADDED','R3_ADDED']))),'changed':sorted(m['CLIENT_FIXES']|m['FLOW_CHANGED'])}))",
   join(f.source,'apps/fleetlab-city/tools/integrate-site.py')],{encoding:'utf8'}));
  const packed=buildSite(f.playground,{sourceCommit:f.commit}),added=new Set(sets.added),changed=new Set(sets.changed);
  // Synthetic historical bytes exercise the exact declared replacement set. All other
  // legacy files are real pack output; this fixture is not a production readback.
  writeFiles(legacy,[...packed].filter(([path])=>!added.has(path)).map(([path,bytes])=>[path,changed.has(path)?'synthetic earlier '+path:bytes]));
  const legacyFiles=inventory(legacy);assert.equal(Object.keys(legacyFiles).length,99);
  const headers=Object.fromEntries(readFileSync(join(legacy,'_headers'),'utf8').split('\n').filter(line=>/^\s+\S[^:]*:/.test(line)).map(line=>{const i=line.indexOf(':');return [line.slice(0,i).trim().toLowerCase(),line.slice(i+1).trim()];}));
  writeFileSync(readback,JSON.stringify({matched:98,total:98,headers_match:true,headers,legacy_headers_sha256:legacyFiles._headers.sha256,
   files:Object.entries(legacyFiles).filter(([p])=>p!=='_headers').map(([path,r])=>({path,...r,matches:true}))}));
  const before={legacy:inventory(legacy),city:inventory(f.raw),offer:inventory(f.offer)};
  const args=['-B',recipe,'--commit',f.commit,'--legacy',legacy,'--legacy-readback',readback,'--city-base',f.raw,'--city-source-offer',f.offer];
  const run=(output,extra=[])=>spawnSync('python3',[...args,'--out',output,...extra],{cwd:f.source,encoding:'utf8',maxBuffer:4*1024*1024});
  const bad=join(f.root,'refused');
  for(const [output,extra,pattern] of [[legacy,[],/exists|overlap/i],[join(f.raw,'nested'),[],/overlap|separate/i],[bad,['--commit','0'.repeat(40)],/exact.*commit|duplicate/i]]){
   const result=run(output,extra);assert.notEqual(result.status,0);assert.match(result.stderr,pattern);assert.equal(existsSync(bad),false);
  }
  const originalManifest=readFileSync(join(f.raw,'release.json'));
  writeFileSync(join(f.raw,'release.json'),Buffer.concat([originalManifest,Buffer.from(' ')]));
  assert.notEqual(run(bad).status,0);assert.equal(existsSync(bad),false);writeFileSync(join(f.raw,'release.json'),originalManifest);
  const observed=readFileSync(readback);writeFileSync(readback,'{}');
  assert.notEqual(run(bad).status,0);assert.equal(existsSync(bad),false);writeFileSync(readback,observed);
  writeFileSync(join(f.source,'dirty.txt'),'uncommitted');
  assert.match(run(bad).stderr,/clean.*source/i);assert.equal(existsSync(bad),false);rmSync(join(f.source,'dirty.txt'));
  // This passes input/readback validation and fails during integration, proving
  // cleanup also holds after the build has created intermediate artifacts.
  const oldHeaders=readFileSync(join(legacy,'_headers'));
  writeFileSync(join(legacy,'_headers'),Buffer.concat([oldHeaders,Buffer.from('\n# synthetic drift\n')]));
  const drifted=JSON.parse(observed);drifted.legacy_headers_sha256=fingerprint(readFileSync(join(legacy,'_headers'))).sha256;
  writeFileSync(readback,JSON.stringify(drifted));
  const failedBuild=run(bad);assert.notEqual(failedBuild.status,0);assert.match(failedBuild.stderr,/undeclared teaching client change/i);
  assert.equal(existsSync(bad),false);assert.ok(!readdirSync(f.root).some(name=>name.startsWith('.fleetlab-build-')));
  writeFileSync(join(legacy,'_headers'),oldHeaders);writeFileSync(readback,observed);
  const out=join(f.root,'release-one'),repeat=join(f.root,'release-two');
  for(const target of [out,repeat]){const result=run(target);assert.equal(result.status,0,result.stderr+'\n'+result.stdout);}
  assert.deepEqual(inventory(join(out,'stage/site')),inventory(join(repeat,'stage/site')));
  assert.deepEqual(JSON.parse(readFileSync(join(out,'build-inputs.json'))),JSON.parse(readFileSync(join(repeat,'build-inputs.json'))));
  const receipt=JSON.parse(readFileSync(join(out,'local-release.json')));
  assert.equal(receipt.source_commit,f.commit);assert.equal(receipt.server_side,'none');
  assert.equal(receipt.server_side_scope,'VERIFIED_LOCAL_STAGE_ONLY');assert.equal(receipt.publication,'NOT_PERFORMED');
  assert.equal(receipt.verification.readback,'NOT_PERFORMED');
  const provenance=readFileSync(join(out,'build-inputs.json'),'utf8');
  assert.ok(!provenance.includes(f.root));
  assert.ok(!provenance.includes('/Users/'));
  assert.ok(!provenance.includes('/home/'));
  assert.deepEqual(before,{legacy:inventory(legacy),city:inventory(f.raw),offer:inventory(f.offer)});
  const saved=inventory(out);assert.notEqual(run(out).status,0);assert.deepEqual(inventory(out),saved);
  assert.ok(!readdirSync(f.root).some(name=>name.startsWith('.fleetlab-build-')),'temporary build directories are removed');
 }finally{f.cleanup();}
});
