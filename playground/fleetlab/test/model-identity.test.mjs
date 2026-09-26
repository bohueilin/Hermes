import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {modelHeader} from '../src/ui/model-identity.js';
test('model identity preserves result version and explicit stale state across template edits',()=>{
 const restore=installFakeDom();try{
  const h=modelHeader('Launch rehearsal','Peninsula','v1');
  assert.equal(h.element.tagName,'P');assert.match(h.element.textContent,/Launch rehearsal.*Peninsula.*v1.*Results are not interchangeable/);
  h.update('v2',true,'Region B');assert.match(h.element.textContent,/Region B.*v2.*stale/i);
  h.update('v3');assert.doesNotMatch(h.element.textContent,/stale/i);
 }finally{restore();}
});
