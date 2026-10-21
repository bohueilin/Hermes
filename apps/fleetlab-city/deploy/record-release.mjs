// Record verified local bytes or supplied public observations; never publish or fetch.
import {readFileSync,writeFileSync,lstatSync,existsSync,renameSync,unlinkSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,dirname,join,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyStage,toolEnvironment} from './stage-guard.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=message=>{throw Error('Release evidence: '+message);};
const within=(root,path)=>{const rel=relative(root,path);return !rel||(!rel.startsWith('..'+(process.platform==='win32'?'\\':'/'))&&rel!=='..'&&!isAbsolute(rel));};
function regular(path){
 for(let parent=resolve(path);;parent=dirname(parent)){
  if(lstatSync(parent).isSymbolicLink())fail('linked evidence refused');
  if(parent===dirname(parent))break;
 }
 if(!lstatSync(path).isFile())fail('regular evidence file required');
 return readFileSync(path);
}
function validSummary(value,count,kind){
 if(!value||value.total!==count||value.matched!==count||
    !/^\d{4}-\d\d-\d\dT.*(?:Z|\+00:00)$/.test(value.captured_at_utc??'')||
    !Number.isFinite(Date.parse(value.captured_at_utc)))fail(kind+' readback summary is incomplete');
}
export function validateReadback(files,rows,readback,headers){
 const served=Object.entries(files).filter(([path])=>path!=='_headers');
 validSummary(readback,served.length,'byte');validSummary(headers,rows.length,'header');
 if(readback.url!=='https://fleetlab.pages.dev'||headers.url!==readback.url)fail('production readback URL differs');
 if(!Array.isArray(readback.files)||readback.files.length!==served.length)fail('byte readback inventory differs');
 const observed=new Map(readback.files.map(row=>[row.path,row]));
 if(observed.size!==served.length)fail('duplicate byte readback paths');
 for(const [path,record] of served){
  const row=observed.get(path);
  if(!row||row.matches!==true||row.transport_ok!==true||row.status!==String(path==='404.html'?404:200)||
     row.bytes!==record.bytes||row.sha256!==record.sha256)fail('byte readback differs: '+path);
 }
 if(!Array.isArray(headers.checks)||headers.checks.length!==rows.length)fail('header readback inventory differs');
 const actual=new Map(headers.checks.map(row=>[row.path,row]));
 if(actual.size!==rows.length)fail('duplicate header readback paths');
 for(const [path,expected,status] of rows){
  const row=actual.get(path);
  if(!row||row.matches!==true||row.transport_ok!==true||row.status!==String(status)||!row.headers)fail('header readback differs: '+path);
  for(const [key,value] of Object.entries(expected)){
   let got=row.headers[key]??null;
   if(key==='content-type'&&value!==null&&typeof got==='string')got=got.split(';',1)[0].trim().toLowerCase();
   if(got!==value)fail('header value differs: '+path+' '+key);
  }
 }
 return {served_files:served.length,matched_files:served.length,header_checks:rows.length,headers_pass:true,
  captured_at_utc:readback.captured_at_utc,headers_captured_at_utc:headers.captured_at_utc};
}

export function recordRelease({site,sourceRoot,commit,output,readback,headers,python='python3',replace=false}){
 if(!site||!sourceRoot||!output||!/^[a-f0-9]{40}$/.test(commit??''))fail('stage, source, exact commit and output required');
 site=resolve(site);sourceRoot=resolve(sourceRoot);output=resolve(output);
 const env=toolEnvironment(process.env);
 const git=(...args)=>execFileSync('git',['-C',sourceRoot,...args],{encoding:'utf8',env,stdio:['ignore','pipe','pipe']}).trim();
 if(git('rev-parse','HEAD')!==commit||git('status','--porcelain'))fail('clean exact source checkout required');
 if(within(dirname(site),output))fail('receipt output must be outside the stage and review tree');
 if(Boolean(readback)!==Boolean(headers))fail('both full byte and header readbacks required');
 for(const name of ['_worker.js','_routes.json','functions'])if(existsSync(join(site,name)))fail('stage contains server-side code or routes');
 const count=verifyStage(site,commit,sourceRoot);
 const manifestBytes=regular(join(dirname(site),'review/integration-manifest.json'));
 const manifest=JSON.parse(manifestBytes),selection=JSON.parse(regular(join(site,'publication.json')));
 let verification={readback:'NOT_PERFORMED'};
 if(readback){
  const bytes=regular(readback),headerBytes=regular(headers);
  const rows=JSON.parse(execFileSync(python,['-B','-c',
   "import json,runpy,sys; from pathlib import Path; print(json.dumps(runpy.run_path(sys.argv[1])['rows'](Path(sys.argv[2]))))",
   join(sourceRoot,'apps/fleetlab-city/tools/check-headers.py'),site],{encoding:'utf8',env,stdio:['ignore','pipe','pipe']}));
  verification={...validateReadback(manifest.files,rows,JSON.parse(bytes),JSON.parse(headerBytes)),
   full_readback_sha256:hash(bytes),production_headers_sha256:hash(headerBytes)};
 }
 const record={schema:readback?'fleetlab.publication-readback/1.0.0':'fleetlab.local-release/1.0.0',
  scope:'EDUCATIONAL_WEBSITE',sf_qualification:'HOLD',authenticity:'NOT_AUTHENTICATED',operational_deployment_permission:'NONE',
  source_commit:commit,current:selection.current,rollback:selection.rollback,
  server_side:'none',server_side_scope:'VERIFIED_LOCAL_STAGE_ONLY',
  publication:readback?'PUBLIC_BYTES_OBSERVED':'NOT_PERFORMED',
  integration_manifest_sha256:hash(manifestBytes),file_count:count,total_bytes:Object.values(manifest.files).reduce((n,r)=>n+r.bytes,0),
  files:Object.fromEntries(Object.entries(manifest.files).filter(([path])=>path!=='_headers')
   .map(([path,r])=>[path,path==='404.html'?{...r,status:404}:r])),verified_at_utc:new Date().toISOString(),verification,
  meaning:'Byte consistency and supplied hosting observations; not independent authenticity, provider configuration, operational authority or permission to deploy.'};
 if(readback)record.stable_url='https://fleetlab.pages.dev';
 if(existsSync(output)&&(!replace||!lstatSync(output).isFile()||lstatSync(output).isSymbolicLink()))fail('output exists; explicit replacement of a regular receipt required');
 // Exclusive creation is the default. Explicit replacement is atomic and never follows an output link.
 const temporary=replace?output+'.tmp-'+randomUUID():output;
 try{writeFileSync(temporary,JSON.stringify(record,null,2)+'\n',{flag:'wx'});if(replace)renameSync(temporary,output);}
 catch(error){if(replace&&existsSync(temporary))unlinkSync(temporary);throw error;}
 return record;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const options={},names={'--site':'site','--source':'sourceRoot','--commit':'commit','--out':'output','--readback':'readback','--headers':'headers','--python':'python'};
  for(let i=2;i<process.argv.length;i++){
   const arg=process.argv[i];
   if(arg==='--replace'){options.replace=true;continue;}
   if(!names[arg]||!process.argv[i+1]||process.argv[i+1].startsWith('--')||options[names[arg]])fail('invalid receipt arguments');
   options[names[arg]]=process.argv[++i];
  }
  const result=recordRelease(options);console.log(JSON.stringify({schema:result.schema,publication:result.publication,server_side:result.server_side}));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
