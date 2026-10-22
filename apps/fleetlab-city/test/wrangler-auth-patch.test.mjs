import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as patch from '../deploy/stage-guard.mjs';

// Exact auth setter excerpt from the hash-pinned Wrangler CLI. Only this fragment is evaluated;
// no Wrangler CLI, network, account or credential store is used by these tests.
const AUTH_SOURCE='      const authorizationHeader = `Bearer ${auth2.apiToken}`;\n'+
 '      validateAuthorizationHeaderValue(authorizationHeader);\n'+
 '      headers.set("Authorization", authorizationHeader);';
class UserError extends Error{}
function setter(){
 assert.equal(typeof patch.sanitizeWranglerAuth,'function');
 return new Function('auth2','headers','validateAuthorizationHeaderValue','UserError',patch.sanitizeWranglerAuth(AUTH_SOURCE));
}

test('the pinned authentication patch preserves a valid opaque token in the request',()=>{
 const headers=new Headers();
 setter()({apiToken:'synthetic-canary'},headers,()=>{},UserError);
 assert.equal(headers.get('Authorization'),'Bearer synthetic-canary');
});

test('malformed tokens cannot escape through upstream header validation errors',()=>{
 const set=setter();
 for(const token of ['synthetic-canary\nsecret-tail','synthetic-canary\rsecret-tail','synthetic-canary-🚗']){
  // Model both upstream error sources: Headers rejecting CR/LF, and Wrangler rejecting Unicode.
  const validate=value=>{if(value.includes('🚗'))throw Error('invalid header '+value);};
  assert.throws(()=>set({apiToken:token},new Headers(),validate,UserError),error=>{
   assert.equal(error.message,'Cloudflare API token could not be used for authentication.');
   assert.equal(error.cause,undefined);
   assert.doesNotMatch(error.stack,/synthetic-canary|secret-tail|🚗/);
   return true;
  });
 }
});

test('authentication patch drift or duplicate anchors fail closed',()=>{
 assert.equal(typeof patch.sanitizeWranglerAuth,'function');
 for(const source of ['',AUTH_SOURCE.replace('validateAuthorizationHeaderValue','changedValidation'),AUTH_SOURCE+'\n'+AUTH_SOURCE]){
  assert.throws(()=>patch.sanitizeWranglerAuth(source),/authentication.*contract/i);
 }
});

const GIT_SOURCE='        logger2.debug("pages deploy: Detecting git repository information...");\n'+
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

test('Wrangler uses supplied commit metadata without spawning token-bearing Git discovery',()=>{
 assert.equal(typeof patch.disableWranglerGitDiscovery,'function');
 const run=new Function('childProcess','logger2',patch.disableWranglerGitDiscovery(GIT_SOURCE)+'\nreturn isGitDir;');
 let spawned=false;
 assert.equal(run({execSync(){spawned=true;}},{debug(){}}),false);
 assert.equal(spawned,false);
});

test('Git-discovery patch drift or duplicate anchors fail closed',()=>{
 assert.equal(typeof patch.disableWranglerGitDiscovery,'function');
 for(const source of ['',GIT_SOURCE.replace('let isGitDir = true','let isGitDir = false'),GIT_SOURCE+'\n'+GIT_SOURCE]){
  assert.throws(()=>patch.disableWranglerGitDiscovery(source),/Git discovery.*contract/i);
 }
});
