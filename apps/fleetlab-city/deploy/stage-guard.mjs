import {verifyBrandedCity} from './branded-city.mjs';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,relative,dirname,join} from 'node:path';
import {verifyIntegrationAssets} from './integration-assets.mjs';

// Wrangler reads .env files, functions/, Wrangler configs and its account cache from its working
// directory, and API hosts or credentials from the environment: it receives neither from the caller.
const WRANGLER_ENV=['PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','LANG','LC_ALL','TERM','NO_COLOR'];
export function wranglerSpawnOptions(environment,cwd){
  const env=Object.fromEntries(WRANGLER_ENV.filter(name=>environment[name]!==undefined).map(name=>[name,environment[name]]));
  return {stdio:'inherit',cwd,env:{...env,WRANGLER_SEND_METRICS:'false'}};
}

// Pages also deploys server code and settings from outside the reviewed file list: a stage
// _worker.js, _routes.json or functions/, a functions/ beside the tools, and Wrangler configs or
// .env files in Wrangler's directory or any parent. It silently skips the stray names.
const SERVER_CODE=['_worker.js','_routes.json','functions'],STRAY=['.DS_Store','node_modules','.git','.wrangler'];
const SETTINGS=['wrangler.toml','wrangler.json','wrangler.jsonc','.wrangler/deploy/config.json','.env','.env.local'];
function present(path){
  try{lstatSync(path);return true;}
  catch(error){if(error.code==='ENOENT'||error.code==='ENOTDIR')return false;throw error;}
}
const ancestors=dir=>dir===dirname(dir)?[dir]:[dir,...ancestors(dirname(dir))];
export function deployPreflight(site,repository,deployDir,wranglerParent){
  site=resolve(site);
  for(const name of SERVER_CODE)if(present(join(site,name)))throw Error(`Stage has server-side ${name}; Pages would run it.`);
  const walk=dir=>{
    for(const entry of readdirSync(dir,{withFileTypes:true})){
      if(STRAY.includes(entry.name))throw Error(`Stage has ${relative(site,join(dir,entry.name))}; Pages would skip it.`);
      if(entry.isDirectory())walk(join(dir,entry.name));
    }
  };
  walk(site);
  for(const dir of [repository,deployDir])if(present(join(dir,'functions')))throw Error(`${join(dir,'functions')} would add Functions to the site.`);
  for(const dir of [...ancestors(resolve(repository)),...ancestors(resolve(wranglerParent))]){
    for(const name of SETTINGS)if(present(join(dir,name)))throw Error(`${join(dir,name)} could change the release's settings, code or credentials.`);
  }
}

export function releaseCommand(args){
  if(args.length===1&&args[0]==='--version')return 'version';
  if(JSON.stringify(args)===JSON.stringify(['pages','deployment','list','--project-name','fleetlab','--json']))return 'list';
  if(args.length===7&&args[0]==='pages'&&args[1]==='deploy'&&args[2]&&!args[2].startsWith('-')&&args[3]==='--project-name'&&args[4]==='fleetlab'&&args[5]==='--branch'&&['codex-city-explorer','feat/fleetlab-playground'].includes(args[6]))return 'deploy';
  throw Error('Unsupported release command. Only version, deployment list, or an explicit fleetlab stage/branch upload is permitted.');
}

export function verifyStage(site,commit,sourceRoot){
  site=resolve(site);
  const manifest=JSON.parse(readFileSync(resolve(dirname(site),'review/integration-manifest.json'),'utf8'));
  const files={};
  function walk(dir){
    if(!lstatSync(dir).isDirectory()||lstatSync(dir).isSymbolicLink())throw Error('Stage directory is not regular.');
    for(const name of readdirSync(dir)){
      const path=resolve(dir,name),stat=lstatSync(path);
      if(stat.isSymbolicLink())throw Error('Linked stage asset refused.');
      if(stat.isDirectory()){walk(path);continue;}
      if(!stat.isFile())throw Error('Special stage asset refused.');
      const rel=relative(site,path).split('\\').join('/'),data=readFileSync(path);
      files[rel]={bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
    }
  }
  walk(site);
  if(Object.keys(files).length!==Object.keys(manifest.files).length)throw Error('Stage inventory differs.');
  for(const [name,record] of Object.entries(files)){
    if(record.sha256!==manifest.files[name]?.sha256||record.bytes!==manifest.files[name]?.bytes)throw Error('Stage bytes differ from reviewed manifest.');
  }
  const selection=JSON.parse(readFileSync(resolve(site,'publication.json'),'utf8'));
  if(selection.source_commit!==commit)throw Error('Stage source commit differs from the clean checkout.');
  const receiptPath='downloads/teaching-package.json';
  const sourcePaths=Object.keys(files).filter(name=>name.startsWith('network-flows/sources/'));
  // The current source generation requires a package for upload. Optional integration
  // remains useful for old fixtures, but deleting all markers cannot downgrade a release.
  if(sourceRoot||manifest.teaching_package||selection.teaching_package||files[receiptPath]||sourcePaths.length){
    if(!sourceRoot)throw Error('Teaching package verification requires the source checkout.');
    const sameRecord=(a,b)=>a&&b&&a.bytes===b.bytes&&a.sha256===b.sha256;
    const packageFiles=manifest.teaching_package;
    if(!packageFiles||!selection.teaching_package||!files[receiptPath]||sourcePaths.length!==1||
      !/^network-flows\/sources\/[a-f0-9]{64}\.json\.gz$/.test(sourcePaths[0])||
      Object.keys(packageFiles).length!==2||
      !sameRecord(packageFiles[receiptPath],files[receiptPath])||
      !sameRecord(packageFiles[sourcePaths[0]],files[sourcePaths[0]])||
      selection.teaching_package.path!==receiptPath||!sameRecord(selection.teaching_package,files[receiptPath])){
      throw Error('Teaching package manifest, files and publication selection disagree or are missing.');
    }
    if(selection.hosted_presentation!=='fleetlab.hosted-presentation/1.0.0')throw Error('Current release requires the approved hosted presentation.');
    verifyIntegrationAssets(sourceRoot,commit,files,packageFiles,selection);
    verifyBrandedCity(site,selection,files,commit);
    execFileSync(process.execPath,[resolve(sourceRoot,'playground/fleetlab/tools/package-proof.mjs'),
      '--check-integrated',site,'--playground',resolve(sourceRoot,'playground/fleetlab'),
      '--source-commit',commit],{stdio:['ignore','pipe','pipe']});
  }
  if(sourceRoot){
    for(const name of ['setup-codec.js','setup-sharing.js','studio.js']){
      const reviewed=readFileSync(resolve(sourceRoot,'playground/fleetlab/src/ui',name));
      if(files['src/ui/'+name]?.sha256!==createHash('sha256').update(reviewed).digest('hex'))throw Error('Stage is missing reviewed client fixes.');
    }
  }
  return Object.keys(files).length;
}
