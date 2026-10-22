import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PassThrough} from 'node:stream';
import {spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import * as guard from '../deploy/stage-guard.mjs';
import {stageFixture} from './stage-fixture.mjs';

const HEAD='0123456789abcdef0123456789abcdef01234567';
const production=['pages','deploy','/synthetic-stage','--project-name','fleetlab','--branch','feat/fleetlab-playground'];
const preview=['pages','deploy','/synthetic-stage','--project-name','fleetlab','--branch','codex-city-explorer'];
const listing=['pages','deployment','list','--project-name','fleetlab','--json'];
const TOKEN_ENV={FLEETLAB_DEPLOY_TOKEN_REF:'keychain:fleetlab-pages-release',CLOUDFLARE_API_TOKEN:'synthetic-not-a-credential'};

test('remote commands require a nonempty owner-injected token alongside the reference',()=>{
 assert.equal(typeof guard.requireReleaseToken,'function');
 for(const command of ['deploy','list']){
  for(const token of [undefined,'']){
   assert.throws(()=>guard.requireReleaseToken({...TOKEN_ENV,CLOUDFLARE_API_TOKEN:token},command),/token.*required/i);
  }
  assert.equal(guard.requireReleaseToken(TOKEN_ENV,command),'synthetic-not-a-credential');
 }
});

test('missing or malformed references refuse without echoing input or accessing the token',()=>{
 assert.equal(typeof guard.requireReleaseToken,'function');
 for(const reference of [undefined,'','fleetlab-pages-release','keychain:','keychain:../item','keychain:item\n','keychain:'+('x'.repeat(129)),'accidentally-pasted-secret']){
  const env={FLEETLAB_DEPLOY_TOKEN_REF:reference,get CLOUDFLARE_API_TOKEN(){throw Error('Token accessed before reference validation');}};
  assert.throws(()=>guard.requireReleaseToken(env,'deploy'),error=>{
   assert.match(error.message,/token reference/i);
   if(reference)assert.equal(error.message.includes(reference),false);
   return true;
  });
 }
});

test('local version runs never access token or reference inputs',()=>{
 assert.equal(typeof guard.requireReleaseToken,'function');
 const untouched=new Proxy({},{get(){throw Error('Local run accessed token input');}});
 assert.equal(guard.requireReleaseToken(untouched,'version'),undefined);
});

test('remote refusal happens before git, tool installation or run-directory creation',t=>{
 const root=mkdtempSync(join(tmpdir(),'fleetlab-token-refusal-test-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const bin=join(root,'bin');mkdirSync(bin);
 for(const name of ['git','npm'])writeFileSync(join(bin,name),`#!${process.execPath}\nrequire('fs').writeFileSync(${JSON.stringify(join(root,'tool-ran'))},'unexpected');process.exit(1);\n`,{mode:0o755});
 const wrapper=fileURLToPath(new URL('../deploy/wrangler.mjs',import.meta.url));
 for(const args of [production,preview,listing]){
  for(const [env,expected] of [[{FLEETLAB_DEPLOY_TOKEN_REF:TOKEN_ENV.FLEETLAB_DEPLOY_TOKEN_REF},/token.*required/i],[{...TOKEN_ENV,FLEETLAB_DEPLOY_TOKEN_REF:'accidentally-pasted-secret'},/token reference/i]]){
   const child=spawnSync(process.execPath,[wrapper,...args],{cwd:root,encoding:'utf8',env:{...guard.toolEnvironment(process.env),PATH:bin,TMPDIR:root,...env}});
   assert.equal(child.status,1);
   assert.match(child.stderr,expected);
   assert.doesNotMatch(child.stderr,/accidentally-pasted-secret|synthetic-not-a-credential/);
   assert.deepEqual(readdirSync(root),['bin']);
  }
 }
});

test('the wrapper removes token inputs before Git or verification subprocesses can inherit them',t=>{
 const root=mkdtempSync(join(tmpdir(),'fleetlab-token-child-test-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const bin=join(root,'bin');mkdirSync(bin);
 writeFileSync(join(bin,'git'),`#!${process.execPath}\nconsole.error(JSON.stringify(Object.keys(process.env)));process.exit(1);\n`,{mode:0o755});
 const wrapper=fileURLToPath(new URL('../deploy/wrangler.mjs',import.meta.url));
 const child=spawnSync(process.execPath,[wrapper,...preview],{cwd:root,encoding:'utf8',env:{...guard.toolEnvironment(process.env),PATH:bin,...TOKEN_ENV}});
 assert.equal(child.status,1);
 assert.match(child.stderr,/PATH/);
 assert.doesNotMatch(child.stderr,/CLOUDFLARE_API_TOKEN|FLEETLAB_DEPLOY_TOKEN_REF|synthetic-not-a-credential/);
});

test('only Wrangler receives the opaque token and its authentication paths are isolated',()=>{
 const environment={HOME:'/synthetic-owner-home',PATH:'/synthetic-bin',...TOKEN_ENV,
  XDG_CONFIG_HOME:'/synthetic-owner-config',WRANGLER_HOME:'/synthetic-owner-wrangler',
  CF_API_TOKEN:'alternate-canary',CLOUDFLARE_API_KEY:'key-canary',CLOUDFLARE_EMAIL:'email-canary',
  WRANGLER_LOG_SANITIZE:'false',CLOUDFLARE_AUTH_USE_KEYRING:'true'};
 // Unusual synthetic bytes demonstrate forwarding without parsing, normalization or trimming.
 const token=' synthetic opaque value ';
 const options=guard.wranglerSpawnOptions(environment,'/synthetic-run/cwd','/synthetic-run/log','/synthetic-run/cache',token);
 assert.equal(options.env.CLOUDFLARE_API_TOKEN,token);
 assert.equal(options.env.HOME,'/synthetic-run/home');
 assert.equal(options.env.XDG_CONFIG_HOME,'/synthetic-run/home/.config');
 assert.equal(options.env.WRANGLER_LOG_SANITIZE,'true');
 assert.equal(options.env.CLOUDFLARE_AUTH_USE_KEYRING,'false');
 assert.deepEqual(options.stdio,['ignore','inherit','inherit']);
 for(const name of ['FLEETLAB_DEPLOY_TOKEN_REF','WRANGLER_HOME','CF_API_TOKEN','CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL'])assert.equal(name in options.env,false,name);
 const install=guard.toolEnvironment(environment);
 for(const name of ['CLOUDFLARE_API_TOKEN','FLEETLAB_DEPLOY_TOKEN_REF','CF_API_TOKEN','CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL'])assert.equal(name in install,false,name);
 // Supplying credentials in the caller environment alone never forwards them to Wrangler.
 assert.equal('CLOUDFLARE_API_TOKEN' in guard.wranglerSpawnOptions(environment,'/synthetic-run/cwd','/synthetic-run/log','/synthetic-run/cache').env,false);
});

function terminal(t){
 const input=new PassThrough(),output=new PassThrough();
 input.isTTY=true;output.isTTY=true;
 let transcript='';output.on('data',chunk=>{transcript+=chunk;});
 t.after(()=>{input.destroy();output.destroy();});
 return {input,output,text:()=>transcript};
}

test('production waits for the exact commit prefix before it can continue',async t=>{
 assert.equal(typeof guard.confirmProduction,'function');
 const tty=terminal(t);
 let continued=false;
 const confirmation=guard.confirmProduction(production,HEAD,tty.input,tty.output).then(()=>{continued=true;});
 assert.match(tty.text(),/fleetlab/);
 assert.match(tty.text(),/feat\/fleetlab-playground/);
 assert.ok(tty.text().includes(HEAD));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(continued,false);
 tty.input.write('0123456789ab\n');
 await confirmation;
 assert.equal(continued,true);
});

test('confirmation stops consuming terminal input before the release child can run',async t=>{
 const tty=terminal(t);
 const confirmation=guard.confirmProduction(production,HEAD,tty.input,tty.output);
 tty.input.write('0123456789ab\n');await confirmation;
 tty.input.write('later input');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(tty.input.read()?.toString(),'later input');
});

test('production confirmation resumes a paused terminal to receive the answer',async t=>{
 const tty=terminal(t);tty.input.pause();
 const confirmation=guard.confirmProduction(production,HEAD,tty.input,tty.output).then(()=>true,()=>false);
 tty.input.write('0123456789ab\n');
 const outcome=await Promise.race([confirmation,new Promise(resolve=>setImmediate(()=>resolve('pending')))]);
 assert.equal(outcome,true);
});

for(const answer of ['yes\n','0123456\n','fedcba987654\n','0123456789ab \n','0123456789ab','']){
 test(`production rejects ${answer ? JSON.stringify(answer) : 'EOF'} instead of continuing`,async t=>{
  assert.equal(typeof guard.confirmProduction,'function');
  const tty=terminal(t);
  const confirmation=guard.confirmProduction(production,HEAD,tty.input,tty.output);
  tty.input.end(answer);
  await assert.rejects(confirmation,/confirmation/i);
 });
}

test('production cannot confirm through a pipe or redirected prompt',async t=>{
 assert.equal(typeof guard.confirmProduction,'function');
 for(const side of ['input','output']){
  const tty=terminal(t);tty[side].isTTY=false;
  await assert.rejects(guard.confirmProduction(production,HEAD,tty.input,tty.output),/terminal/i);
  assert.equal(tty.text(),'');
 }
});

test('production refuses an invalid source commit before presenting a prompt',async t=>{
 assert.equal(typeof guard.confirmProduction,'function');
 const tty=terminal(t);
 for(const head of ['',HEAD.slice(0,12),HEAD+'\n']){
  await assert.rejects(guard.confirmProduction(production,head,tty.input,tty.output),/commit/i);
 }
 assert.equal(tty.text(),'');
});

test('preview, deployment listing and local version runs never inspect the terminal or prompt',async()=>{
 assert.equal(typeof guard.confirmProduction,'function');
 const untouched=new Proxy({},{get(){throw Error('Non-production touched terminal');}});
 for(const args of [preview,['pages','deployment','list','--project-name','fleetlab','--json'],['--version']]){
  await guard.confirmProduction(args,undefined,untouched,untouched);
 }
});

test('the real production wrapper refuses piped confirmation before installing or running release tools',t=>{
 const f=stageFixture();t.after(f.cleanup);
 const bin=join(f.root,'bin');mkdirSync(bin);
 writeFileSync(join(bin,'npm'),`#!${process.execPath}\nrequire('fs').writeFileSync(${JSON.stringify(join(f.root,'npm-ran'))},'unexpected');process.exit(1);\n`,{mode:0o755});
 const args=[...production];args[2]=f.site;
 const child=spawnSync(process.execPath,[join(f.source,'apps/fleetlab-city/deploy/wrangler.mjs'),...args],{
  cwd:f.source,encoding:'utf8',input:f.commit.slice(0,12)+'\n',
  env:{...guard.toolEnvironment(process.env),PATH:bin+':'+process.env.PATH,TMPDIR:f.root,...TOKEN_ENV},
 });
 assert.equal(child.status,1);
 assert.match(child.stderr,/Production confirmation requires an interactive terminal/);
 assert.equal(readdirSync(f.root).includes('npm-ran'),false);
 assert.equal(readdirSync(f.root).some(name=>name.startsWith('fleetlab-wrangler-')),false);
});
