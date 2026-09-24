import test from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {decisionForConfig,decisionView,comparisonLearning} from '../src/ui/scenario-learning.js';

test('each optional situation explains the intervention, population and next experiment',()=>{
  const restore=installFakeDom();try{
    for(const config of [{readiness:{}},{charging:{}},{resources:{}},{airport:{}},{launch:{}}]){
      const d=decisionForConfig(config),view=decisionView(d);
      for(const field of ['question','change','hold','watch','meaning','next','limits'])assert.ok(d[field]?.length,field);
      assert.match(view.textContent,/Fleet optimization decision/);assert.match(view.textContent,/Next experiment/);
    }
    assert.notEqual(decisionForConfig({charging:{policy:'deadline'}}).id,decisionForConfig({charging:{policy:'equal_share'}}).id);
  }finally{restore();}
});
test('learning never treats an improved primary as permission to ignore failed guards',()=>{
  const note=comparisonLearning({validity:'VALID',analysis:{outcome:'IMPROVED',recommendation:'HOLD',primary:{mean_delta:.06},guardrail_statuses:[{metric:'terminal_energy_kwh',status:'VIOLATED'}]}});
  assert.match(note,/HOLD/);assert.match(note,/terminal_energy_kwh/);assert.doesNotMatch(note,/winner|deploy|guarantee/i);
  assert.match(comparisonLearning({validity:'INVALID_EXPERIMENT',reason:'unavailable'}),/unavailable/);
  assert.match(comparisonLearning({validity:'VALID',descriptive:true,analysis:null}),/One seed/);
  assert.match(comparisonLearning({validity:'VALID',analysis:{outcome:'UNCHANGED',recommendation:'NO_RECOMMENDATION',primary:{mean_delta:0},guardrail_statuses:[]}}),/practical margin/);
});
