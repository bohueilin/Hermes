import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {stageFixture} from './stage-fixture.mjs';
import {recordRelease} from '../deploy/record-release.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const files={'index.html':{bytes:4,sha256:digest('page')},'404.html':{bytes:7,sha256:digest('missing')},'_headers':{bytes:6,sha256:digest('policy')}};
const rows=[['/',{'content-security-policy':"default-src 'none'"},200],['/missing',{'content-type':'text/html','content-disposition':null},404]];
function evidence(){
 const base={url:'https://fleetlab.pages.dev',captured_at_utc:'2026-10-21T00:00:00Z',total:2,matched:2};
 return {readback:{...base,files:Object.entries(files).filter(([p])=>p!=='_headers').map(([path,r])=>({path,...r,status:path==='404.html'?'404':'200',transport_ok:true,matches:true}))},
  headers:{...base,checks:rows.map(([path,expected,status])=>({path,status:String(status),transport_ok:true,matches:true,mismatches:{},headers:Object.fromEntries(Object.entries(expected).filter(([,v])=>v!==null))}))}};
}
test('receipt checks full observed bytes and header values, not success flags',async()=>{
 const {validateReadback}=await import('../deploy/record-release.mjs');
 const clean=evidence();assert.equal(validateReadback(files,rows,clean.readback,clean.headers).served_files,2);
 const cases=[
  r=>r.readback.files.pop(),r=>r.readback.files.push({...r.readback.files[0]}),
  r=>r.readback.files[0].sha256='0'.repeat(64),r=>r.readback.files[0].transport_ok=false,
  r=>r.readback.files[0].status='302',r=>r.readback.matched=1,
  r=>r.headers.checks[0].headers['content-security-policy']="default-src *",
  r=>r.headers.checks[1].headers['content-disposition']='attachment',
  r=>r.headers.checks.pop(),r=>r.headers.checks[1].path='/',
  r=>r.headers.url='https://other.invalid',r=>r.readback.captured_at_utc='yesterday',
 ];
 for(const mutate of cases){const bad=evidence();mutate(bad);assert.throws(()=>validateReadback(files,rows,bad.readback,bad.headers),/readback|header|evidence/i);}
 const charset=evidence();charset.headers.checks[1].headers['content-type']='text/html; charset=utf-8';
 assert.equal(validateReadback(files,rows,charset.readback,charset.headers).header_checks,2);
});

test('receipt writer verifies a source-bound stage and labels local evidence without publication',()=>{
 const f=stageFixture();
 try{
  const output=join(f.root,'local-release.json'),args={site:f.site,sourceRoot:f.source,commit:f.commit,output};
  const record=recordRelease(args);
  assert.equal(record.server_side,'none');assert.equal(record.server_side_scope,'VERIFIED_LOCAL_STAGE_ONLY');
  assert.equal(record.publication,'NOT_PERFORMED');assert.equal(record.verification.readback,'NOT_PERFORMED');
  assert.equal(record.authenticity,'NOT_AUTHENTICATED');assert.equal(record.operational_deployment_permission,'NONE');
  assert.deepEqual(JSON.parse(readFileSync(output)),record);
  assert.ok(!Object.hasOwn(record.files,'_headers'),'public readback must not request host configuration');
  assert.equal(record.files['404.html'].status,404);
  const replay=JSON.parse(execFileSync('python3',['-B','-c',
   "import json,runpy,sys; m=runpy.run_path(sys.argv[1]); r=json.load(open(sys.argv[2])); v=m['verify']; v.__globals__['request']=lambda base,name: {**r['files'][name],'status':('404' if name in ('404.html','_headers') else '200'),'transport_ok':True}; print(json.dumps(v('http://fixture.invalid',r['files'],workers=1)))",
   join(f.source,'apps/fleetlab-city/tools/readback.py'),output],{encoding:'utf8'}));
  assert.equal(replay.matched,Object.keys(record.files).length);assert.equal(replay.total,replay.matched);
  const served=Object.entries(record.files).filter(([p])=>p!=='_headers');
  const byteEvidence={url:'https://fleetlab.pages.dev',captured_at_utc:'2026-10-21T00:00:00Z',total:served.length,matched:served.length,
   files:served.map(([path,r])=>({path,...r,status:path==='404.html'?'404':'200',matches:true,transport_ok:true}))};
  const headerRows=JSON.parse(execFileSync('python3',['-B','-c',
   "import json,runpy,sys; from pathlib import Path; print(json.dumps(runpy.run_path(sys.argv[1])['rows'](Path(sys.argv[2]))))",
   join(f.source,'apps/fleetlab-city/tools/check-headers.py'),f.site],{encoding:'utf8'}));
  const headerEvidence={url:byteEvidence.url,captured_at_utc:byteEvidence.captured_at_utc,total:headerRows.length,matched:headerRows.length,
   checks:headerRows.map(([path,expected,status])=>({path,status:String(status),transport_ok:true,matches:true,headers:Object.fromEntries(Object.entries(expected).filter(([,v])=>v!==null))}))};
  // Synthetic observations exercise receipt assembly, never claim live acceptance.
  const readback=join(f.root,'readback.json'),headers=join(f.root,'headers.json');
  writeFileSync(readback,JSON.stringify(byteEvidence));writeFileSync(headers,JSON.stringify(headerEvidence));
  const observed=recordRelease({...args,output:join(f.root,'observed.json'),readback,headers});
  assert.equal(observed.schema,'fleetlab.publication-readback/1.0.0');
  assert.equal(observed.publication,'PUBLIC_BYTES_OBSERVED');assert.equal(observed.server_side,'none');
  assert.equal(observed.verification.matched_files,served.length);
  assert.equal(observed.verification.full_readback_sha256,digest(readFileSync(readback)));
  assert.throws(()=>recordRelease({...args,readback:'unpaired.json'}),/both.*readbacks/i);
  assert.throws(()=>recordRelease({...args,output:join(f.review,'bad.json')}),/outside.*stage/i);
  const original=readFileSync(output);
  assert.throws(()=>recordRelease(args),/output exists/i);assert.deepEqual(readFileSync(output),original);
  writeFileSync(join(f.site,'_worker.js'),'export default {}');
  assert.throws(()=>recordRelease({...args,output:join(f.root,'refused.json')}),/server-side/);
  assert.equal(existsSync(join(f.root,'refused.json')),false);rmSync(join(f.site,'_worker.js'));
  const entry=join(f.site,'city-explorer/index.html');writeFileSync(entry,readFileSync(entry)+'changed');f.seal();
  assert.throws(()=>recordRelease({...args,output:join(f.root,'refused.json')}),/City.*differ/i);
  assert.equal(existsSync(join(f.root,'refused.json')),false);
 }finally{f.cleanup();}
});
