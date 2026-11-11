import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {createDepotFlowLab} from '../src/ui/depot-flow-lab.js';
import {FLOW_GLOSSARY} from '../src/ui/depot-flow-reading.js';
import {glossaryView,GLOSSARY} from '../src/ui/teaching-frames.js';
test('real Depot Flow method retains every custom glossary definition',()=>{const restore=installFakeDom();try{const lab=createDepotFlowLab({yieldPage:()=>Promise.resolve()});const glossary=lab.element.querySelector('.teaching-glossary');assert.ok(glossary);for(const definition of Object.values(FLOW_GLOSSARY))assert.ok(glossary.textContent.includes(definition),definition);assert.equal(glossary.querySelectorAll('p').length,Object.keys(FLOW_GLOSSARY).length);lab.destroy();}finally{restore();}});
test('mixed grouped and extension glossary entries appear exactly once',()=>{const restore=installFakeDom();try{const definition='Custom: a future teaching definition.';const view=glossaryView({Seed:GLOSSARY.Seed,custom:definition});assert.equal(view.querySelectorAll('p').length,2);assert.ok(view.textContent.includes(GLOSSARY.Seed));assert.ok(view.textContent.includes(definition));}finally{restore();}});
