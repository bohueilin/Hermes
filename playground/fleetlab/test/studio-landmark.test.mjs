import test from 'node:test';
import assert from 'node:assert/strict';
import {start} from '../src/ui/app.js';
import {installFakeDom} from './helpers/fake-dom.mjs';

function withApp(studio,fn){
 const restore=installFakeDom();let app;
 try{
  const root=document.createElement('div');root.id='fleetlab-root';
  const strip=document.createElement('div');strip.id='fleetlab-teaching-strip';root.appendChild(strip);document.body.appendChild(root);
  const forbidden=()=>{throw new Error('A heading or navigation must not execute the regional engine');};
  app=start({studio,createWorker:()=>null,copyText:null,engineHost:{path:'worker',ready:Promise.resolve('worker'),runWindow:forbidden,runPair:forbidden,runExperiment:forbidden,cancel(){}}});
  fn(app);
 }finally{app?.destroy();restore();}
}

test('standalone regional app preserves its document title heading',()=>withApp(false,app=>{
 assert.equal(app.regions.topbar.querySelector('.fl-title').tagName,'H1');
 assert.equal(app.root.querySelectorAll('h1').length,1);
}));

test('embedded regional workspaces expose one visible page heading without a second brand H1',()=>withApp(true,app=>{
 assert.equal(app.regions.topbar.querySelector('.fl-title').tagName,'P');
 for(const page of ['operations','depots','tour']){
  app.studio.navigate(page);
  const headings=app.studio.element.querySelectorAll('h1').filter(node=>!node.inHiddenOrInert());
  assert.equal(headings.length,1,`${page} has one active H1`);
  assert.ok(headings[0].textContent.length>0);
  assert.equal(app.root.hidden,false);
 }
}));
