import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderPage} from '../hosted/site-transform.mjs';
import {INTEGRATION_TEXT_PATHS} from '../../../playground/fleetlab/tools/software-delivery-package.mjs';

test('flagship share metadata is server rendered and idempotent with approved artwork',()=>{
 for(const [title,url] of [['Fleet day · FleetLab','https://fleetlab.pages.dev/network-flows/fleet-day/'],['City explorer · FleetLab','https://fleetlab.pages.dev/city-explorer/']]){
  const input=`<html><head><title>${title}</title></head><body>Original honesty framing</body></html>`;
  const html=renderPage(input);
  assert.match(html,/<meta name="description" content="[^\"]+">/);
  assert.ok(html.includes(`<meta property="og:url" content="${url}">`));
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
  assert.match(html,/simulation|synthetic/i);
  assert.match(html,/og:image/);assert.match(html,/twitter:image/);assert.match(html,/enhancement-media\/FL-A[23]/);
  assert.ok(html.includes('Original honesty framing'));
  assert.equal(renderPage(html),html);
 }
 const home=readFileSync(new URL('../../../playground/fleetlab/index.html',import.meta.url),'utf8');
 const original=home.match(/<meta name="description"[^>]+>/)[0];
 assert.ok(renderPage(home).includes(original),'Home retains its existing description verbatim');
});

test('network hub is a five-question path into existing lessons with no model runtime',()=>{
 const html=readFileSync(new URL('../hosted/network-hub.html',import.meta.url),'utf8');
 const routes=['capacity','software-delivery','delivery-order','rebalancing','dispatch'];
 for(const route of routes)assert.equal((html.match(new RegExp(`href="/network-flows/${route}/"`,'g'))??[]).length,1);
 assert.equal((html.match(/class="journey-stop"/g)??[]).length,5);
 assert.match(html,/journey-strip/);
 assert.match(html,/Synthetic scenario · not operational data/);
 assert.match(html,/NOT_EVIDENCE · simulation only · decision authority NONE/);
 assert.doesNotMatch(html,/<script|FL-A4|<video|<canvas/);
 // One bounded, non-numbered deeper experiment outside the five-question strip; no sixth lesson.
 const [strip,after]=html.split('</ol>');
 assert.equal((html.match(/href="\/depot-readiness\/"/g)??[]).length,1);
 assert.doesNotMatch(strip,/depot-readiness/);
 assert.match(after,/<p class="hub-deeper">Deeper experiment, outside the five questions: <a href="\/depot-readiness\/">/);
 assert.match(readFileSync(new URL('../hosted/network-hub.css',import.meta.url),'utf8'),/\.hub-deeper\{/);
});

test('retired lesson reaches software delivery and sitemap lists only durable physical routes',()=>{
 const redirect=readFileSync(new URL('../hosted/ota-sharing-redirect.html',import.meta.url),'utf8');
 assert.match(redirect,/content="0;url=\/network-flows\/software-delivery\/"/);
 assert.match(redirect,/href="\/network-flows\/software-delivery\/"/);
 const sitemap=readFileSync(new URL('../hosted/sitemap.xml',import.meta.url),'utf8');
 for(const route of ['','city-explorer/','network-flows/','network-flows/fleet-day/','network-flows/capacity/','network-flows/software-delivery/','network-flows/delivery-order/','network-flows/rebalancing/','network-flows/dispatch/','depot-readiness/'])assert.ok(sitemap.includes(`<loc>https://fleetlab.pages.dev/${route}</loc>`));
 assert.doesNotMatch(sitemap,/#|ota-sharing|releases\//);
 for(const path of ['network-flows/index.html','network-flows/hub.css','network-flows/ota-sharing/index.html','sitemap.xml'])assert.ok(INTEGRATION_TEXT_PATHS.includes(path),`${path} must be counted as integration text`);
});
