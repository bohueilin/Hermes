import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {decorateDesign} from '../hosted/brand.mjs';
import {renderPage,BRAND_MEDIA,ARTWORK_GROUPS} from '../hosted/site-transform.mjs';

test('all header shapes keep a visible HTML wordmark next to the supplied mark',()=>{
 const restore=installFakeDom();try{
  for(const name of ['studio-monogram','delivery-brand','brand']){
   const h=document.createElement('header'),a=document.createElement('a');a.className=name;a.setAttribute('href','/#/overview');a.textContent='Old';h.appendChild(a);document.body.appendChild(h);
  }
  decorateDesign(document);decorateDesign(document);
  const marks=document.querySelectorAll('header .design-brand');assert.equal(marks.length,3);
  for(const a of marks){assert.equal(a.querySelector('strong')?.textContent,'FleetLab');assert.equal(a.querySelectorAll('img').length,1);assert.equal(a.querySelector('img').getAttribute('alt'),'');assert.match(a.querySelector('img').getAttribute('srcset'),/64w.*128w.*256w/);assert.equal(a.getAttribute('href'),'/#/overview');}
 }finally{restore();}
});
test('footer and offline download panel receive the mark once without replacing their content',()=>{
 const restore=installFakeDom();try{
  const f=document.createElement('footer'),copy=document.createElement('p'),panel=document.createElement('div');copy.textContent='Existing disclosure';panel.className='offline-edition';panel.textContent='Download offline edition';f.appendChild(copy);f.appendChild(panel);document.body.appendChild(f);
  decorateDesign(document);decorateDesign(document);
  assert.equal(f.querySelectorAll('.design-footer-mark').length,1);assert.equal(panel.querySelectorAll('.design-panel-mark').length,1);assert.ok(f.textContent.includes('Existing disclosure'));assert.ok(panel.textContent.includes('Download offline edition'));
 }finally{restore();}
});
test('favicon and touch icon are same-origin and transformation remains idempotent',()=>{
 const input='<html><head></head><body>Untouched lesson</body></html>',html=renderPage(input);
 assert.match(html,/rel="icon"[^>]*href="\/site-media\/favicon.png"/);
 assert.match(html,/rel="apple-touch-icon"[^>]*href="\/site-media\/apple-touch-icon.png"/);
 assert.equal(renderPage(html),html);assert.ok(html.includes('Untouched lesson'));
});
test('responsive mark inventory has exact ownership and preserves the existing media byte cap',()=>{
 const group=ARTWORK_GROUPS.find(g=>g.root.endsWith('/brand-media'));
 assert.equal(group.maxBytes,2*1024*1024);assert.equal(group.maxFiles,7);
 for(const path of ['site-media/fleetlab-logo.png','site-media/fleetlab-logo-64.png','site-media/fleetlab-logo-128.png','site-media/favicon.png','site-media/apple-touch-icon.png'])assert.ok(BRAND_MEDIA[path],path);
});
