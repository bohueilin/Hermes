import {verifyBrandedCity} from './branded-city.mjs';
import {verifyCityEvidence} from './city-evidence.mjs';
import {existsSync,readFileSync,readdirSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,relative,dirname,join} from 'node:path';
import {verifyIntegrationAssets} from './integration-assets.mjs';

// Wrangler reads .env files, functions/, Wrangler configs and its account cache from its working
// directory or the nearest node_modules above it, and API hosts or credentials from the environment.
// Only the explicitly supplied release token may reach Wrangler; npm gets the short allowlist.
// Wrangler's home/config, log and cache belong to this run, never the owner's ambient login.
const TOOL_ENV=['PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','LANG','LC_ALL','TERM','NO_COLOR'];
export const toolEnvironment=environment=>Object.fromEntries(TOOL_ENV.filter(name=>environment[name]!==undefined).map(name=>[name,environment[name]]));
export function wranglerSpawnOptions(environment,cwd,log,cache,token){
  const home=join(cwd,'..','home');
  return {stdio:['ignore','inherit','inherit'],cwd,env:{...toolEnvironment(environment),HOME:home,XDG_CONFIG_HOME:join(home,'.config'),
    ...(token===undefined?{}:{CLOUDFLARE_API_TOKEN:token}),
    CLOUDFLARE_AUTH_USE_KEYRING:'false',WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_SANITIZE:'true',WRANGLER_LOG_PATH:log,WRANGLER_CACHE_DIR:cache}};
}

// This is non-secret provenance metadata, not a Keychain reader or a scope/expiry verifier.
// The owner injects the value for this invocation; carry it opaquely without parsing or logging it.
export function requireReleaseToken(environment,command){
  if(command==='version')return;
  if(!['deploy','list'].includes(command))throw Error('Unsupported token-bearing release command.');
  const reference=environment.FLEETLAB_DEPLOY_TOKEN_REF;
  if(typeof reference!=='string'||/^keychain:[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.exec(reference)?.[0]!==reference)throw Error('Missing or malformed FleetLab token reference.');
  const token=environment.CLOUDFLARE_API_TOKEN;
  if(typeof token!=='string'||token==='')throw Error('An owner-injected FleetLab token is required for remote commands.');
  return token;
}

// The pinned CLI otherwise includes malformed header values in validation errors. Sanitize at
// that boundary without inspecting the token here. A changed or duplicated anchor is a refusal.
export function sanitizeWranglerAuth(source){
  const before='      const authorizationHeader = `Bearer ${auth2.apiToken}`;\n'+
    '      validateAuthorizationHeaderValue(authorizationHeader);\n'+
    '      headers.set("Authorization", authorizationHeader);';
  const after='      const authorizationHeader = `Bearer ${auth2.apiToken}`;\n'+
    '      try {\n'+
    '        validateAuthorizationHeaderValue(authorizationHeader);\n'+
    '        headers.set("Authorization", authorizationHeader);\n'+
    '      } catch {\n'+
    '        throw new UserError("Cloudflare API token could not be used for authentication.", {\n'+
    '          telemetryMessage: "cfetch auth invalid authorization header"\n'+
    '        });\n'+
    '      }';
  if(source.split(before).length!==2)throw Error('Wrangler authentication error contract changed.');
  return source.replace(before,after);
}

// The wrapper already supplies all commit metadata. Avoid a redundant shell/Git child inheriting
// the token from Wrangler. Noninteractive stdin also disables its missing-project creation path.
export function disableWranglerGitDiscovery(source){
  const before='        logger2.debug("pages deploy: Detecting git repository information...");\n'+
    '        let isGitDir = true;\n'+
    '        try {\n'+
    '          childProcess.execSync(`git rev-parse --is-inside-work-tree`, {\n'+
    '            stdio: "ignore"\n'+
    '          });\n'+
    '          logger2.debug("pages deploy: Git repository detected");\n'+
    '        } catch (err) {\n'+
    '          isGitDir = false;\n'+
    '          logger2.debug(\n'+
    '            `pages deploy: Not a git repository or git not available: ${err instanceof Error ? err.message : String(err)}`\n'+
    '          );\n'+
    '        }';
  if(source.split(before).length!==2)throw Error('Wrangler Git discovery contract changed.');
  return source.replace(before,'        const isGitDir = false;');
}

// The allowlisted production branch needs a fresh interactive acknowledgement of the verified
// source commit. Preview, listing and local version checks do not consume terminal input.
export async function confirmProduction(args,head,input=process.stdin,output=process.stderr){
  if(releaseCommand(args)!=='deploy'||args[6]!=='feat/fleetlab-playground')return;
  if(typeof head!=='string'||!/^[a-f0-9]{40}$/.test(head)||head.length!==40)throw Error('Production confirmation requires a full source commit.');
  if(!input.isTTY||!output.isTTY)throw Error('Production confirmation requires an interactive terminal.');
  const prefix=head.slice(0,12);
  await new Promise((accept,reject)=>{
    let answer='';
    const failure=()=>finish(false);
    function finish(confirmed){
      input.removeListener('data',read);
      for(const event of ['end','close','error'])input.removeListener(event,failure);
      // Stop the parent consuming stdin before a later child inherits the same terminal.
      input.pause();
      if(confirmed)accept();else reject(Error('Production confirmation failed; no release was started.'));
    }
    function read(chunk){
      // Bound the first line and require Enter; EOF after the right prefix is still refusal.
      answer+=chunk.toString().slice(0,14);
      const newline=answer.indexOf('\n');
      if(newline!==-1){
        const line=answer.slice(0,newline);
        finish(line===prefix||line===prefix+'\r');
      }else if(answer.length>13)failure();
    }
    input.on('data',read);
    for(const event of ['end','close','error'])input.once(event,failure);
    output.write(`Production: fleetlab / feat/fleetlab-playground\nSource commit: ${head}\nType ${prefix} to confirm: `);
    if(input.readableEnded||input.destroyed)failure();else input.resume();
  });
}

// Wrangler logs these when it bundles or routes server code or follows a config redirect, and logs
// every API request and token refresh with its full URL.
const SERVER_OUTPUT=['Compiled Worker','Uploading Functions bundle','Uploading Worker bundle','Uploading _routes.json','Using redirected Wrangler configuration'];
const API_HOSTS=['api.cloudflare.com','dash.cloudflare.com'];
export function checkWranglerLog(log,command='deploy'){
  if(!['deploy','list'].includes(command))throw Error('Unsupported Wrangler log command.');
  if(!existsSync(log))throw Error(`Wrangler wrote no log at ${log}, so its output and API hosts are unchecked.`);
  const text=readFileSync(log,'utf8');
  for(const marker of SERVER_OUTPUT)if(text.includes(marker))throw Error(`Wrangler logged "${marker}"; review the release and ${log}.`);
  for(const [,address] of text.matchAll(/(?:-- START CF API REQUEST: (?:[A-Z]+ )?|Fetching auth token from )(\S+)/g)){
    const url=URL.canParse(address)?new URL(address):null;
    if(!url||url.protocol!=='https:'||url.port||!API_HOSTS.includes(url.hostname))throw Error(`Wrangler contacted ${address}, not a Cloudflare API or token host; review ${log}.`);
  }
  // Recognize complete records emitted by the hash-pinned CLI, not arbitrary success-looking
  // text. This is post-run log evidence, not independent proof of remote deployment state.
  const records=[...text.matchAll(/(?:^|\n)--- \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z (debug|info|log|warn|error)\n([\s\S]*?)\n---(?=\n|$)/g)]
    .map(([,level,body])=>({level,body}));
  const requestPattern=command==='deploy'
    ? /^-- START CF API REQUEST: [A-Z]+ https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/[^/\s]+\/pages\/projects\/fleetlab(?:[/?][^\s]*)?$/
    : /^-- START CF API REQUEST: GET https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/[^/\s]+\/pages\/projects\/fleetlab\/deployments$/;
  const request=records.findIndex(record=>record.level==='debug'&&requestPattern.test(record.body));
  const recognized=request!==-1&&records.slice(request+1).some(record=>{
    if(record.level!=='log')return false;
    if(command==='deploy')return /^✨ Deployment complete! Take a peek over at https:\/\/[a-z0-9-]+\.fleetlab\.pages\.dev\/?(?:\n✨ Deployment alias URL: https:\/\/(?:[a-z0-9-]+\.)?fleetlab\.pages\.dev\/?)?$/.exec(record.body)?.[0]===record.body;
    try{
      const rows=JSON.parse(record.body);
      return Array.isArray(rows)&&rows.every(row=>row&&['Id','Environment','Branch','Source','Deployment','Status','Build'].every(key=>typeof row[key]==='string'));
    }catch{return false;}
  });
  if(!recognized)throw Error(`Wrangler log has no recognizable ${command} record; review ${log}.`);
}

// A Pages command takes its account from the cached pages.json and records the account and project
// it used there. The cache starts empty for every run, so afterwards it may name only fleetlab.
export function checkPagesCache(cache){
  const path=join(cache,'pages.json');
  if(!present(path))return;
  const project=JSON.parse(readFileSync(path,'utf8')).project_name;
  if(project!==undefined&&project!=='fleetlab')throw Error(`Wrangler cached the Pages project ${JSON.stringify(project)}, not fleetlab; review ${path}.`);
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
    const originalCityBase=verifyCityEvidence(site,sourceRoot,selection,files);
    verifyBrandedCity(site,selection,files,commit,originalCityBase);
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
