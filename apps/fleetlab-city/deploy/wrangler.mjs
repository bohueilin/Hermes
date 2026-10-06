// Exact upstream CLI plus the previously used serial Pages upload settings.
// Never modifies the installed upstream file; regenerates a local sibling copy.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {verifyStage,releaseCommand} from './stage-guard.mjs';

const args=process.argv.slice(2), deploy=releaseCommand(args)==='deploy';
if(deploy){
  const repository=fileURLToPath(new URL('../../../',import.meta.url));
  if(resolve(execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim())!==resolve(repository))throw Error('Run the release tool from its own source checkout.');
  if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Commit reviewed changes before publishing.');
  const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  args[2]=resolve(args[2]);
  verifyStage(args[2],head,repository);
  args.push('--commit-hash',head,'--commit-dirty=false');
}
const original=new URL('./node_modules/wrangler/wrangler-dist/cli.js',import.meta.url);
let source=readFileSync(original,'utf8');
if(createHash('sha256').update(source).digest('hex')!=='028a1b0d560594692aa44bda69079d700617164bf7d4de93a4ba3aa5b401ff1c')throw Error('Unexpected Wrangler CLI bytes; run npm ci from the committed lock.');
for(const [from,to] of [['MAX_BUCKET_SIZE = 40 * 1024 * 1024;','MAX_BUCKET_SIZE = 8 * 1024 * 1024;'],['BULK_UPLOAD_CONCURRENCY2 = 3;','BULK_UPLOAD_CONCURRENCY2 = 1;']]){
  if(source.split(from).length!==2)throw Error('Upload constant contract changed.');
  source=source.replace(from,to);
}
const patched=new URL('./node_modules/wrangler/wrangler-dist/cli.fleetlab.cjs',import.meta.url);
writeFileSync(patched,source,{mode:0o600});
const result=spawnSync(process.execPath,['--no-warnings',fileURLToPath(patched),...args],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false'}});
if(result.error)throw result.error;
process.exit(result.status??1);
