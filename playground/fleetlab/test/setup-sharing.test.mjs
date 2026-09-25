import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSetupSharing} from '../src/ui/setup-sharing.js';
import {defaultStreetConfig} from '../src/model/street-simulation.js';
import {decodeSetup} from '../src/ui/setup-codec.js';
import {parseRoute} from '../src/ui/routes.js';
import {installFakeDom} from './helpers/fake-dom.mjs';

test('sharing is explicit, labels the selected snapshot and exposes a selectable copy fallback',async()=>{
 const restore=installFakeDom();try{
  let captures=0,link;const panel=createSetupSharing({models:[['street-lab','Street lab']],page:'streets',baseUrl:()=> 'https://example.test/',capture:source=>{captures++;assert.equal(source,'last-run');return {model:'street-lab',config:defaultStreetConfig(),options:{}};},onLink:href=>{link=href;},copy:async()=>{throw Error('Denied');}});
  document.body.appendChild(panel.element);assert.equal(captures,0);
  panel.element.querySelector('[aria-label="Setup snapshot"]').value='last-run';
  panel.element.querySelector('[data-action="create-setup-link"]').click();
  assert.equal(captures,1);assert.equal(decodeSetup(parseRoute(link).setup).model,'street-lab');
  const url=panel.element.querySelector('[aria-label="Generated setup link"]');assert.match(url.value,/https:\/\/example.test\/#\/street-lab\?setup=/);
  assert.match(panel.element.textContent,/Last completed run/);
  panel.element.querySelector('[data-action="copy-setup-link"]').click();await Promise.resolve();await Promise.resolve();
  assert.match(panel.element.textContent,/Select and copy/);
 }finally{restore();}
});
test('unavailable or invalid snapshots do not publish a link or retain a previous successful link',()=>{
 const restore=installFakeDom();try{
  let fail=false,calls=0;const panel=createSetupSharing({models:[['street-lab','Street lab']],page:'streets',capture:()=>{if(fail)throw Error('No completed run');return {model:'street-lab',config:defaultStreetConfig(),options:{}};},onLink:()=>{calls++;},baseUrl:()=>''});
  panel.element.querySelector('[data-action="create-setup-link"]').click();fail=true;panel.element.querySelector('[data-action="create-setup-link"]').click();
  assert.equal(calls,1);assert.match(panel.element.textContent,/No completed run/);assert.equal(panel.element.querySelector('[aria-label="Generated setup link"]').value,'');
 }finally{restore();}
});
