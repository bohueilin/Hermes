// Exact upstream CLI plus the previously used serial Pages upload settings. Every run installs the
// release tools fresh from the committed lock into a directory the wrapper owns, so the git-ignored
// node_modules tree is never loaded; npm checks each package against the lock's integrity hash.
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {verifyStage,releaseCommand,toolEnvironment,wranglerSpawnOptions,deployPreflight,checkWranglerLog,checkPagesCache,confirmProduction,requireReleaseToken,sanitizeWranglerAuth,disableWranglerGitDiscovery} from './stage-guard.mjs';

const args=process.argv.slice(2), command=releaseCommand(args), deployDir=fileURLToPath(new URL('./',import.meta.url));
const token=requireReleaseToken(process.env,command);
// Git, verification builders and npm must not inherit the injected credential or its reference.
delete process.env.CLOUDFLARE_API_TOKEN;
delete process.env.FLEETLAB_DEPLOY_TOKEN_REF;
if(command==='deploy'){
  const repository=fileURLToPath(new URL('../../../',import.meta.url));
  if(resolve(execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim())!==resolve(repository))throw Error('Run the release tool from its own source checkout.');
  if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Commit reviewed changes before publishing.');
  const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  args[2]=resolve(args[2]);
  await confirmProduction(args,head);
  // User input may take time. Verify the source and stage after that pause, before any tools run.
  if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==head||
    execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Source changed during release confirmation; start again.');
  // Wrangler runs in a fresh directory under tmpdir(), so its config search starts there.
  deployPreflight(args[2],repository,deployDir,realpathSync(tmpdir()));
  verifyStage(args[2],head,repository);
  const message=execFileSync('git',['show','-s','--format=%B',head],{encoding:'utf8'}).trim();
  args.push('--commit-hash',head,'--commit-dirty=false','--commit-message',message);
}
// One temporary directory per run holds the tools, an empty working directory (no caller file can
// add config, server code or credentials), Wrangler's own account cache and its log; the cache and
// log are kept unless the run and the checks pass. The tools, with the patched CLI copy, are
// deleted as soon as Wrangler exits.
const run=mkdtempSync(join(tmpdir(),'fleetlab-wrangler-')),tools=join(run,'tools'),cwd=join(run,'cwd'),cache=join(run,'cache'),log=join(run,'wrangler.log'),home=join(run,'home');
let result;
try{
  mkdirSync(tools);
  for(const name of ['package.json','package-lock.json','.npmrc'])copyFileSync(join(deployDir,name),join(tools,name));
  const install=spawnSync('npm',['ci','--ignore-scripts'],{stdio:'inherit',cwd:tools,env:toolEnvironment(process.env)});
  if(install.status!==0)throw install.error??Error('npm ci --ignore-scripts failed; the release tools were not installed.');
  const dist=join(tools,'node_modules/wrangler/wrangler-dist');
  let source=readFileSync(join(dist,'cli.js'),'utf8');
  if(createHash('sha256').update(source).digest('hex')!=='028a1b0d560594692aa44bda69079d700617164bf7d4de93a4ba3aa5b401ff1c')throw Error('Unexpected Wrangler CLI bytes; run npm ci --ignore-scripts from the committed lock.');
  for(const [from,to] of [['MAX_BUCKET_SIZE = 40 * 1024 * 1024;','MAX_BUCKET_SIZE = 8 * 1024 * 1024;'],['BULK_UPLOAD_CONCURRENCY2 = 3;','BULK_UPLOAD_CONCURRENCY2 = 1;']]){
    if(source.split(from).length!==2)throw Error('Upload constant contract changed.');
    source=source.replace(from,to);
  }
  source=sanitizeWranglerAuth(source);
  source=disableWranglerGitDiscovery(source);
  const patched=join(dist,'cli.fleetlab.cjs');
  writeFileSync(patched,source,{mode:0o600,flag:'wx'});
  mkdirSync(cwd);
  mkdirSync(join(home,'.config'),{recursive:true,mode:0o700});
  result=spawnSync(process.execPath,['--no-warnings',patched,...args],wranglerSpawnOptions(process.env,cwd,log,cache,token));
}finally{
  rmSync(tools,{recursive:true,force:true});
  rmSync(cwd,{recursive:true,force:true});
  rmSync(home,{recursive:true,force:true});
  if(!result)rmSync(run,{recursive:true,force:true});
}
if(result.error)throw result.error;
// --version makes no request; the other commands must show no server code and only Cloudflare hosts.
// No command may leave another Pages project in the cache.
if(command!=='version')checkWranglerLog(log);
checkPagesCache(cache);
if(result.status===0)rmSync(run,{recursive:true,force:true});
process.exit(result.status??1);
