import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {renderPage,googleTag,policyFor} from '../hosted/site-transform.mjs';
import {buildSite} from '../../../playground/fleetlab/tools/pack.mjs';

const shell='<html><head><meta charset="utf-8"><title>FleetLab</title></head><body><video src="./film.mp4" controls></video><script type="module" src="./boot.js"></script></body></html>';
test('frozen source-offer HTML gains citation arrows while keeping its local license and downloads',()=>{
 const input='<html><head><title>Map data &amp; licenses · FleetLab</title></head><body><a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a><a href="./ODbL-1.0.txt">ODbL 1.0</a><ul><li><a href="./captured-sources.tar.gz">Captured sources</a></li></ul></body></html>';
 const html=renderPage(input,{analytics:true});
 assert.ok(html.includes('>OpenStreetMap contributors ↗</a>'));
 assert.ok(html.includes('href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL 1.0 ↗</a>'));
 assert.ok(html.includes('href="./ODbL-1.0.txt">local license copy ↓</a>'));
 assert.ok(html.includes('<ul><li><a href="./captured-sources.tar.gz">Captured sources</a></li></ul>'));
 assert.equal(renderPage(html,{analytics:true}),html);
});
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
test('no page that carries the Google tag keeps a no-analytics, no-cookies or no-tracking promise',()=>{
 const stale=/no (?:app )?analytics|no cookies|no tracking|no telemetry/i;
 const teaching=buildSite(fileURLToPath(new URL('../../../playground/fleetlab/',import.meta.url)));
 const pages=new Map([...teaching].filter(([path])=>path.endsWith('.html')).map(([path,data])=>[path,String(data)]));
 for(const name of ['404.html','city-releases-redirect.html','fleet-day-redirect.html','map-sources.html'])pages.set(`hosted/${name}`,readFileSync(new URL(`../hosted/${name}`,import.meta.url),'utf8'));
 // The current City generation renders the viewer page, whose analytics-free footer the transform replaces.
 pages.set('web/index.html',readFileSync(new URL('../web/index.html',import.meta.url),'utf8'));
 assert.ok(pages.size>=10);
 for(const [path,html] of pages){
  const rendered=renderPage(html,{analytics:true});
  assert.ok(rendered.includes('googletagmanager.com/gtag/js'),path);
  assert.doesNotMatch(rendered,stale,path);
 }
});
