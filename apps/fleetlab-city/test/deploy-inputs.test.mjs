import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {wranglerSpawnOptions,deployPreflight,checkWranglerLog} from '../deploy/stage-guard.mjs';

// Inputs that could redirect Wrangler's API host, token refresh, credentials, account or code.
const CANARY={CLOUDFLARE_API_BASE_URL:'http://127.0.0.1:9/client/v4',CF_API_BASE_URL:'http://127.0.0.1:9/client/v4',
 WRANGLER_TOKEN_URL:'http://127.0.0.1:9/token',CLOUDFLARE_API_TOKEN:'canary',CLOUDFLARE_ACCOUNT_ID:'canary',
 XDG_CONFIG_HOME:'/nonexistent/config',NODE_OPTIONS:'--require=/nonexistent/hook.js'};

test('Wrangler runs in a fresh empty directory with only an allowlisted environment',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'fleetlab-wrangler-test-'));
 try{
  const options=wranglerSpawnOptions({...process.env,...CANARY},cwd,join(cwd,'..','wrangler.log'));
  assert.equal(options.cwd,cwd);
  assert.equal(options.env.WRANGLER_LOG_PATH,join(cwd,'..','wrangler.log'));
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
 assert.match(source,/wranglerSpawnOptions\(process\.env,cwd,log\)/);
 assert.doesNotMatch(source,/process\.env\}|\.\.\.process\.env/);
 // Outside a Git checkout Wrangler cannot detect the message it used to read from git.
 assert.match(source,/'--commit-message'/);
 assert.ok(source.indexOf('deployPreflight(args[2]')<source.indexOf('verifyStage(args[2]'));
 assert.match(source,/if\(command!=='version'\)checkWranglerLog\(log\);/);
});

const write=(path,data='x')=>{mkdirSync(dirname(path),{recursive:true});writeFileSync(path,data);};
// A checkout with its release-tool folder, a stage shaped like a release, and Wrangler's parent directory.
function preflightFixture(t){
 const root=realpathSync(mkdtempSync(join(tmpdir(),'fleetlab-preflight-test-')));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const fixture={root,repository:join(root,'outer/repo'),site:join(root,'stage/site'),wrangler:join(root,'wrangler-parent')};
 fixture.deploy=join(fixture.repository,'apps/fleetlab-city/deploy');
 mkdirSync(fixture.deploy,{recursive:true});mkdirSync(fixture.wrangler);
 for(const name of ['index.html','_headers','publication.json','boot.js','src/ui/studio.js','city-explorer/index.html',
  'downloads/teaching-package.json','network-flows/sources/'+'0'.repeat(64)+'.json.gz'])write(join(fixture.site,name));
 return fixture;
}
const preflight=fixture=>deployPreflight(fixture.site,fixture.repository,fixture.deploy,fixture.wrangler);

test('the deploy preflight passes a clean stage-shaped fixture',t=>{
 assert.doesNotThrow(()=>preflight(preflightFixture(t)));
});

const REFUSED=[
 ['a stage _worker.js file',f=>write(join(f.site,'_worker.js')),/server-side _worker\.js/],
 ['a stage _worker.js directory',f=>write(join(f.site,'_worker.js/index.js')),/server-side _worker\.js/],
 ['a stage _routes.json',f=>write(join(f.site,'_routes.json'),'{}'),/server-side _routes\.json/],
 ['a stage functions/',f=>write(join(f.site,'functions/_middleware.js')),/server-side functions/],
 ['a nested .DS_Store',f=>write(join(f.site,'city-explorer/.DS_Store')),/city-explorer\/\.DS_Store; Pages would skip/],
 ['a nested node_modules',f=>write(join(f.site,'src/node_modules/a.js')),/src\/node_modules;/],
 ['a stage .git file',f=>write(join(f.site,'.git'),'gitdir: elsewhere'),/Stage has \.git;/],
 ['a nested .wrangler',f=>write(join(f.site,'downloads/.wrangler/cache.json')),/downloads\/\.wrangler;/],
 ['a checkout functions/_middleware.js',f=>write(join(f.repository,'functions/_middleware.js')),/repo\/functions would add Functions/],
 ['a git-ignored checkout functions/build',f=>write(join(f.repository,'functions/build/a.js')),/repo\/functions would add Functions/],
 ['a functions/ in the release-tool folder',f=>write(join(f.deploy,'functions/index.js')),/deploy\/functions would add Functions/],
 ['wrangler.toml in a parent of the checkout',f=>write(join(f.root,'outer/wrangler.toml')),/outer\/wrangler\.toml could change/],
 ['wrangler.json in the checkout root',f=>write(join(f.repository,'wrangler.json'),'{}'),/repo\/wrangler\.json could change/],
 ['wrangler.jsonc beside Wrangler',f=>write(join(f.wrangler,'wrangler.jsonc'),'{}'),/wrangler-parent\/wrangler\.jsonc could change/],
 ['a Wrangler config redirect',f=>write(join(f.root,'.wrangler/deploy/config.json'),'{}'),/\.wrangler\/deploy\/config\.json could change/],
 ['a checkout .env',f=>write(join(f.repository,'.env'),'CLOUDFLARE_API_TOKEN=canary'),/repo\/\.env could change/],
 ['a .env.local above Wrangler',f=>write(join(f.wrangler,'.env.local'),'CLOUDFLARE_ACCOUNT_ID=canary'),/\.env\.local could change/],
 ['a dangling .env link',f=>symlinkSync(join(f.root,'missing'),join(f.repository,'.env')),/repo\/\.env could change/],
];
for(const [label,plant,refusal] of REFUSED){
 test(`the deploy preflight refuses ${label}`,t=>{
  const fixture=preflightFixture(t);
  plant(fixture);
  assert.throws(()=>preflight(fixture),refusal);
 });
}

// Synthetic entries in the shape Wrangler writes; the preview URL is output, not a request.
const CLEAN_LOG=['debug\n-- START CF API REQUEST: GET https://api.cloudflare.com/client/v4/accounts/0000/pages/projects/fleetlab',
 'debug\nFetching auth token from https://dash.cloudflare.com/oauth2/token',
 'debug\n-- START CF API REQUEST: POST https://api.cloudflare.com/client/v4/pages/assets/upload',
 'log\n✨ Success! Uploaded 2 files (10138 already uploaded) (1.20 sec)','log\n✨ Uploading _headers',
 'log\n✨ Deployment complete! Take a peek over at https://0123abcd.fleetlab.pages.dev'];
function logFile(t,entries){
 const dir=mkdtempSync(join(tmpdir(),'fleetlab-log-test-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const log=join(dir,'wrangler.log');
 writeFileSync(log,entries.map(entry=>`\n--- 2026-10-16T01:51:42.000Z ${entry}\n---\n`).join(''));
 return log;
}

test('the log check passes a clean upload log and refuses a missing log',t=>{
 assert.doesNotThrow(()=>checkWranglerLog(logFile(t,CLEAN_LOG)));
 assert.throws(()=>checkWranglerLog(join(tmpdir(),'fleetlab-no-such-dir','wrangler.log')),/wrote no log/);
});

const FORBIDDEN=[
 ['log\n✨ Compiled Worker successfully',/Compiled Worker/],
 ['log\n✨ Uploading Functions bundle',/Uploading Functions bundle/],
 ['log\n✨ Uploading Worker bundle',/Uploading Worker bundle/],
 ['log\n✨ Uploading _routes.json',/Uploading _routes\.json/],
 ['info\nUsing redirected Wrangler configuration.\n - Configuration being used: "../app/wrangler.toml"',/Using redirected Wrangler configuration/],
 ['debug\n-- START CF API REQUEST: GET http://127.0.0.1:9/client/v4/accounts',/127\.0\.0\.1:9/],
 ['debug\n-- START CF API REQUEST: POST https://api.cloudflare.com.relay.example/client/v4/pages',/relay\.example/],
 ['debug\n-- START CF API REQUEST: GET https://api.cloudflare.com@relay.example/client/v4',/relay\.example/],
 ['debug\n-- START CF API REQUEST: GET https://api.cloudflare.com:8443/client/v4',/:8443/],
 ['debug\n-- START CF API REQUEST: GET http://api.cloudflare.com/client/v4',/http:\/\/api\.cloudflare\.com/],
 ['debug\n-- START CF API REQUEST: https://relay.example/client/v4/accounts',/relay\.example/],
 ['debug\n-- START CF API REQUEST: GET /client/v4/accounts',/\/client\/v4\/accounts, not a Cloudflare/],
 ['debug\nFetching auth token from https://relay.example/oauth2/token',/relay\.example/],
];
for(const [entry,refusal] of FORBIDDEN){
 test(`the log check refuses ${entry.split('\n')[1]}`,t=>{
  assert.throws(()=>checkWranglerLog(logFile(t,[...CLEAN_LOG,entry])),refusal);
 });
}
