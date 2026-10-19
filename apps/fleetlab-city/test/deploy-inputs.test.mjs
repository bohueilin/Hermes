import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {wranglerSpawnOptions} from '../deploy/stage-guard.mjs';

// Inputs that could redirect Wrangler's API host, token refresh, credentials, account or code.
const CANARY={CLOUDFLARE_API_BASE_URL:'http://127.0.0.1:9/client/v4',CF_API_BASE_URL:'http://127.0.0.1:9/client/v4',
 WRANGLER_TOKEN_URL:'http://127.0.0.1:9/token',CLOUDFLARE_API_TOKEN:'canary',CLOUDFLARE_ACCOUNT_ID:'canary',
 XDG_CONFIG_HOME:'/nonexistent/config',NODE_OPTIONS:'--require=/nonexistent/hook.js'};

test('Wrangler runs in a fresh empty directory with only an allowlisted environment',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'fleetlab-wrangler-test-'));
 try{
  const options=wranglerSpawnOptions({...process.env,...CANARY},cwd);
  assert.equal(options.cwd,cwd);
  for(const name of Object.keys(CANARY))assert.equal(name in options.env,false,name);
  assert.equal(options.env.WRANGLER_SEND_METRICS,'false');
  assert.equal(options.env.HOME,process.env.HOME);
  const probe='console.log(JSON.stringify({cwd:process.cwd(),files:require("fs").readdirSync("."),env:Object.keys(process.env).sort()}))';
  const seen=JSON.parse(spawnSync(process.execPath,['-e',probe],{...options,stdio:'pipe',encoding:'utf8'}).stdout);
  assert.equal(realpathSync(seen.cwd),realpathSync(cwd));
  assert.deepEqual(seen.files,[]);
  // macOS itself adds __CF_USER_TEXT_ENCODING to every process.
  assert.deepEqual(seen.env.filter(name=>name!=='__CF_USER_TEXT_ENCODING'),Object.keys(options.env).sort());
 }finally{rmSync(cwd,{recursive:true,force:true});}
});

test('the release wrapper spawns Wrangler only through those options',()=>{
 const source=readFileSync(new URL('../deploy/wrangler.mjs',import.meta.url),'utf8');
 assert.match(source,/mkdtempSync\(join\(tmpdir\(\)/);
 assert.match(source,/wranglerSpawnOptions\(process\.env,cwd\)/);
 assert.doesNotMatch(source,/process\.env\}|\.\.\.process\.env/);
 // Outside a Git checkout Wrangler cannot detect the message it used to read from git.
 assert.match(source,/'--commit-message'/);
});
