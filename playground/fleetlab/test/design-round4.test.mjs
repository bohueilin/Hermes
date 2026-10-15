import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {createOperationsLab} from '../src/ui/operations-lab.js';
import {createAdvancedExperimentControls} from '../src/ui/advanced-operations-view.js';
import {createOrderPage} from '../src/ui/delivery-order-page.js';
import {ORDER_STUDY} from '../src/data/delivery-order-study.js';

test('fractional controls expose decimal text, preserve precision and reject non-decimal syntax',()=>{
 const restore=installFakeDom(),lab=createOperationsLab({reducedMotion:()=>true});try{
  const n=lab.element.querySelector('[aria-label="Rush-hour demand"]');
  assert.equal(n.getAttribute('type'),'text');assert.equal(n.getAttribute('inputmode'),'decimal');assert.equal(n.value,'1.6');
  n.value='1.23456789';n.dispatchEvent(new Event('input'));assert.equal(lab.getState().config.peak_multiplier,1.6);
  n.dispatchEvent(new Event('change'));assert.equal(lab.getState().config.peak_multiplier,1.23456789);
  for(const value of ['','0x2','Infinity','bad']){n.value=value;n.dispatchEvent(new Event('change'));assert.ok(Number.isNaN(lab.getState().config.peak_multiplier),value);}
  const c=createAdvancedExperimentControls(()=>{},()=>{}),margin=c.element.querySelector('[aria-label="Smallest meaningful difference"]');
  assert.equal(margin.getAttribute('type'),'text');assert.equal(margin.value,'0.02');margin.value='0.0123456789';assert.equal(c.options().margin,.0123456789);
  margin.value='';assert.ok(Number.isNaN(c.options().margin));
 }finally{lab.destroy();restore();}
});
test('published order cards keep values and explain Compare before any run; 24 means every permutation',()=>{
 const restore=installFakeDom();try{
  const p=createOrderPage({manifest:ORDER_STUDY,runStudy:()=>{throw Error('must not run');}});
  const cards=p.element.querySelectorAll('.outcome-grid article');
  assert.match(cards[1].textContent,/Compare my order/);assert.match(cards[1].textContent,/178 s/);assert.match(cards[1].textContent,/378 s/);
  assert.match(p.element.textContent,/24.*permutations.*four vehicles/);
  p.move('V4',-1);assert.match(cards[1].textContent,/178 s/);p.destroy();
 }finally{restore();}
});
test('shared lesson chrome has stable navigation, glossary anchors and one trust line without losing onward links',async()=>{
 const restore=installFakeDom();try{
  const {networkChrome}=await import('../src/ui/network-chrome.js').catch(()=>({}));assert.equal(typeof networkChrome,'function');
  const root=document.createElement('div'),header=document.createElement('header'),nav=document.createElement('nav'),main=document.createElement('main'),footer=document.createElement('footer'),onward=document.createElement('a');
  onward.href='/previous/';onward.textContent='Previous lesson';footer.appendChild(onward);header.appendChild(nav);root.append(header,main,footer);
  networkChrome(root);networkChrome(root);
  assert.deepEqual([...nav.querySelectorAll('a')].map(a=>a.textContent),['Home','Explore','About & limits']);
  assert.equal(root.querySelectorAll('#network-vocabulary').length,1);
  assert.match(root.querySelector('#glossary-vor').textContent,/Vehicle Off-Road/);
  assert.match(main.textContent,/off the drive network, not off the pavement/);
  assert.match(main.textContent,/FleetLab teaching labels/);
  assert.equal(footer.querySelectorAll('.network-trust').length,1);assert.match(footer.textContent,/Previous lesson/);
 }finally{restore();}
});
