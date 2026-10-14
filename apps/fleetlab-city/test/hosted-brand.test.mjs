import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {renderPage,googleTag,policyFor} from '../hosted/site-transform.mjs';

const shell='<html><head><meta charset="utf-8"><title>FleetLab</title></head><body><video src="./film.mp4" controls></video><script type="module" src="./boot.js"></script></body></html>';
test('preview preserves the film and page boot but cannot load or execute Google analytics',()=>{
 const html=renderPage(shell);
 assert.ok(html.includes('<video src="./film.mp4" controls></video>'));
 assert.ok(html.includes('<script type="module" src="./boot.js"></script>'));
 assert.equal((html.match(/<script\b[^>]*\ssrc="https:\/\/www.googletagmanager.com/g)||[]).length,0);
 assert.equal((html.match(/data-fleetlab-design/g)||[]).length,1);
 assert.equal(renderPage(html),html);
});
test('production markup puts exactly one Google loader and config immediately after head',()=>{
 const html=renderPage(shell,{analytics:true});
 assert.ok(html.startsWith('<html><head><!-- Google tag (gtag.js) -->'));
 assert.equal((html.match(/src="https:\/\/www.googletagmanager.com\/gtag\/js\?id=G-04EZ8EZWQ2"/g)||[]).length,1);
 assert.equal((html.match(/gtag\('config'/g)||[]).length,1);
 assert.equal(renderPage(html,{analytics:true}),html);
});
test('the configured tag disables collection outside the production host',()=>{
 const inline=googleTag(true).match(/<script>([\s\S]*?)<\/script>/)[1];
 for(const hostname of ['127.0.0.1','localhost','candidate.fleetlab.pages.dev','fleetlab.pages.dev']){
  const window={location:{hostname},Date};window.window=window;vm.runInNewContext(inline,window);
  assert.equal(window['ga-disable-G-04EZ8EZWQ2'],hostname!=='fleetlab.pages.dev');
  assert.equal(window.dataLayer.filter(x=>x[0]==='config').length,1);
 }
});
test('unowned Google tags are rejected rather than silently doubled',()=>{
 assert.throws(()=>renderPage(shell.replace('<head>','<head><script src="https://www.googletagmanager.com/gtag/js?id=G-OTHER"></script>')),/already contains/);
});
test('policy permits only the requested tag while retaining restrictive map and worker rules',()=>{
 const base="default-src 'none'; script-src 'self'; connect-src 'self'; worker-src 'self' blob:; form-action 'none'; img-src 'self' data: blob:";
 assert.equal(policyFor(base,false),base);
 const policy=policyFor(base,true);
 assert.match(policy,/script-src 'self' 'sha256-[^']+' https:\/\/www.googletagmanager.com/);
 assert.match(policy,/worker-src 'self' blob:/);
 assert.doesNotMatch(policy,/unsafe-inline|unsafe-eval|doubleclick|googlesyndication/);
 assert.match(policy,/connect-src 'self' https:\/\/www.googletagmanager.com https:\/\/\*\.google-analytics.com https:\/\/\*\.google.com/);
});
