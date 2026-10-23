import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import * as guard from '../deploy/stage-guard.mjs';

const ACCOUNT='0123456789abcdef0123456789abcdef';
const TOKEN_ENV={FLEETLAB_DEPLOY_TOKEN_REF:'keychain:synthetic-release',CLOUDFLARE_API_TOKEN:'synthetic-not-a-credential'};
const preview=['pages','deploy','/synthetic-stage','--project-name','fleetlab','--branch','codex-city-explorer'];
const listing=['pages','deployment','list','--project-name','fleetlab','--json'];

test('remote account selection accepts an exact ID and retains discovery when omitted',()=>{
 assert.equal(typeof guard.releaseAccountId,'function');
 for(const command of ['deploy','list']){
  assert.equal(guard.releaseAccountId({},command),undefined);
  assert.equal(guard.releaseAccountId({CLOUDFLARE_ACCOUNT_ID:ACCOUNT},command),ACCOUNT);
  assert.equal(guard.releaseAccountId({CLOUDFLARE_ACCOUNT_ID:ACCOUNT.toUpperCase()},command),ACCOUNT.toUpperCase());
  for(const account of ['',ACCOUNT+'\n',' '+ACCOUNT,ACCOUNT.slice(1),ACCOUNT+'0','../account','x'.repeat(32),42]){
   assert.throws(()=>guard.releaseAccountId({CLOUDFLARE_ACCOUNT_ID:account},command),error=>{
    assert.match(error.message,/account ID/i);
    if(account)assert.equal(error.message.includes(String(account)),false);
    return true;
   });
  }
 }
});

test('local version never reads the account input',()=>{
 assert.equal(typeof guard.releaseAccountId,'function');
 const untouched=new Proxy({},{get(){throw Error('Local version read account input');}});
 assert.equal(guard.releaseAccountId(untouched,'version'),undefined);
});

test('only the explicit Wrangler spawn receives the selected account',()=>{
 const environment={PATH:'/synthetic-bin',HOME:'/synthetic-home',CLOUDFLARE_ACCOUNT_ID:'ambient-not-selected',...TOKEN_ENV};
 const args=[environment,'/synthetic-run/cwd','/synthetic-run/log','/synthetic-run/cache','synthetic-not-a-credential'];
 const options=guard.wranglerSpawnOptions(...args,ACCOUNT);
 assert.equal(options.env.CLOUDFLARE_ACCOUNT_ID,ACCOUNT);
 assert.equal(options.env.CLOUDFLARE_API_TOKEN,'synthetic-not-a-credential');
 assert.equal(options.env.HOME,'/synthetic-run/home');
 assert.deepEqual(options.stdio,['ignore','inherit','inherit']);
 assert.equal('CLOUDFLARE_ACCOUNT_ID' in guard.toolEnvironment(environment),false);
 assert.equal('CLOUDFLARE_ACCOUNT_ID' in guard.wranglerSpawnOptions(...args).env,false);
});

test('malformed account selection refuses before Git, installation or directory creation',t=>{
 const root=mkdtempSync(join(tmpdir(),'fleetlab-account-refusal-test-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const bin=join(root,'bin');mkdirSync(bin);
 for(const name of ['git','npm'])writeFileSync(join(bin,name),`#!${process.execPath}\nrequire('fs').writeFileSync(${JSON.stringify(join(root,'tool-ran'))},'unexpected');process.exit(1);\n`,{mode:0o755});
 const wrapper=fileURLToPath(new URL('../deploy/wrangler.mjs',import.meta.url));
 for(const args of [preview,listing]){
  const child=spawnSync(process.execPath,[wrapper,...args],{cwd:root,encoding:'utf8',env:{...guard.toolEnvironment(process.env),PATH:bin,TMPDIR:root,...TOKEN_ENV,CLOUDFLARE_ACCOUNT_ID:'accidentally-pasted-value'}});
  assert.equal(child.status,1);
  assert.match(child.stderr,/account ID/i);
  assert.doesNotMatch(child.stderr,/accidentally-pasted-value|synthetic-not-a-credential/);
  assert.deepEqual(readdirSync(root),['bin']);
 }
});

test('Git never inherits the account selection or token inputs from the wrapper',t=>{
 const root=mkdtempSync(join(tmpdir(),'fleetlab-account-child-test-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const bin=join(root,'bin');mkdirSync(bin);
 writeFileSync(join(bin,'git'),`#!${process.execPath}\nconsole.error(JSON.stringify(Object.keys(process.env)));process.exit(1);\n`,{mode:0o755});
 const wrapper=fileURLToPath(new URL('../deploy/wrangler.mjs',import.meta.url));
 const child=spawnSync(process.execPath,[wrapper,...preview],{cwd:root,encoding:'utf8',env:{...guard.toolEnvironment(process.env),PATH:bin,...TOKEN_ENV,CLOUDFLARE_ACCOUNT_ID:ACCOUNT}});
 assert.equal(child.status,1);
 assert.match(child.stderr,/PATH/);
 assert.doesNotMatch(child.stderr,/CLOUDFLARE_ACCOUNT_ID|CLOUDFLARE_API_TOKEN|FLEETLAB_DEPLOY_TOKEN_REF|synthetic-not-a-credential/);
});
