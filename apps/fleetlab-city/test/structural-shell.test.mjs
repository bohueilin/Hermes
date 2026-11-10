import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {decorateDesign,decorateShell,decorateCityOrientation} from '../hosted/brand.mjs';

function add(tag,parent,attrs={},text=''){
 const node=document.createElement(tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);node.textContent=text;parent.appendChild(node);return node;
}
test('City global shell is idempotent; local sections retain their handlers and independent navigation',()=>{
 const restore=installFakeDom();try{
  const h=add('header',document.body,{class:'masthead'});add('a',h,{class:'brand',href:'/#/home'},'FleetLab');
  const tabs=add('nav',h,{class:'tabs','aria-label':'Explorer sections'}),button=add('button',tabs,{'data-view':'atlas'},'City atlas');
  let clicks=0;button.addEventListener('click',()=>clicks++);
  const main=add('main',document.body),intro=add('section',main,{class:'intro'});add('h1',intro,{},'City');
  decorateShell(document);decorateShell(document);
  assert.equal(h.querySelectorAll('.design-global-nav').length,1);assert.equal(h.querySelectorAll('nav').length,1);
  assert.deepEqual(h.querySelectorAll('.design-global-nav a').map(a=>a.textContent),['Home','Fleet day','Street lab','Explore','About & limits']);
  assert.equal(tabs.parentNode,main);assert.equal(tabs.previousSibling,intro);button.click();assert.equal(clicks,1);
  const menu=h.querySelector('.design-shell-menu');menu.click();assert.equal(menu.getAttribute('aria-expanded'),'true');assert.equal(h.querySelector('nav').getAttribute('data-expanded'),'true');
  assert.equal(document.querySelector('footer time').getAttribute('datetime'),'2026-11-08');
 }finally{restore();}
});
test('sources are a front door with a skip link and SF v1 orientation; download hrefs stay exact',()=>{
 const restore=installFakeDom();try{
  document.title='Map data & licenses · FleetLab';const main=add('main',document.body),list=add('ul',main),li=add('li',list);
  const download=add('a',li,{href:'./sf-v1-complete.tar.gz'},'SF v1');
  decorateDesign(document);decorateDesign(document);
  assert.equal(document.querySelectorAll('header').length,1);assert.equal(document.querySelectorAll('footer').length,1);
  assert.equal(document.querySelectorAll('#design-source-start').length,1);assert.match(document.querySelector('#design-source-start').textContent,/separate from that recorded experiment/);
  assert.equal(download.getAttribute('href'),'./sf-v1-complete.tar.gz');assert.equal(download.getAttribute('aria-describedby'),'design-source-start');
  assert.equal(document.querySelector('.design-source-skip').getAttribute('href'),'#source-content');
  assert.equal(document.querySelector('.design-honesty').textContent,'Synthetic operations; map qualification remains open. Not affiliated with or endorsed by Waymo, Zoox, or their partners. No operational authority.');
 }finally{restore();}
});
test('qualification lead explains the checklist without editing any ledger rows or exact correction',()=>{
 const restore=installFakeDom();try{
  const limits=add('section',document.body,{id:'limits-view'}),panel=add('div',limits,{class:'panel'}),ledger=add('div',panel,{id:'qualification-ledger'},'Road-class support FAIL · Semantic inspection NOT_RUN');
  const correction=add('div',limits,{class:'panel'});add('h3',correction,{},'Method correction · 29 Sep 2026');const exact=add('p',correction,{},'two no_reachable_depot violations; capacity_kwh = 60 unused metadata');
  decorateCityOrientation(document);decorateCityOrientation(document);
  assert.equal(ledger.textContent,'Road-class support FAIL · Semantic inspection NOT_RUN');assert.equal(document.querySelectorAll('#design-ledger-lead').length,1);
  assert.equal(exact.parentNode.tagName,'DETAILS');assert.match(exact.textContent,/no_reachable_depot/);assert.match(correction.textContent,/did not cross the reserve threshold/);
 }finally{restore();}
});
test('a static page header gets the shell box from brand.css before brand.mjs decorates it',()=>{
 // Readiness paints its HTML header before any module runs; giving that header the final box keeps main from moving.
 // City's masthead is left out: its tabs move into main when decorated, so its first box cannot match the final one.
 const css=readFileSync(new URL('../hosted/brand.css',import.meta.url),'utf8');
 assert.equal(css.match(/header\.design-shell\{/g),null);
 assert.equal(css.split('header:is(.design-shell,body>:where(:not(.masthead))){').length-1,3);
});
test('the static studio shell fills the first screen until the studio mounts before it',()=>{
 // Without this, the privacy note below the shell is visible on phones and is pushed away by the first render.
 assert.match(readFileSync(new URL('../hosted/visitor.css',import.meta.url),'utf8'),/noscript\+#fleetlab-root\{min-height:100vh\}/);
});
