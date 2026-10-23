import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateStoppedStudy} from '../web/study-status.mjs';
const fixture=()=>{
 const seeds=Array.from({length:24},(_,i)=>7304001+i);
 const cells=seeds.flatMap(seed=>['a-200','ab-200','b-200','a-400','ab-400','b-400'].map(arm=>({seed,arm,status:'NOT_RUN'})));cells[0].status='RECORDED';
 return {schema:'fleetlab.power-status/1.0.0',analysis_status:'INCOMPLETE',primary:null,scope:'SIMULATION_ONLY',decision_authority:'NONE',failure:{detail:'resource stop'},seeds,cells,completed_arms:1,scheduled_arms:144,not_run_arms:143};
};
test('partial status preserves the entire scheduled population and unavailable estimate',()=>assert.equal(validateStoppedStudy(fixture()).primary,null));
test('partial populations, invented estimates and inconsistent counts refuse',()=>{
 for(const edit of [x=>x.cells.pop(),x=>x.primary={mean:1},x=>x.completed_arms=144,x=>x.cells[1]=x.cells[0],x=>x.seeds.pop(),x=>x.cells[1].status='RECORDED']){const x=fixture();edit(x);assert.throws(()=>validateStoppedStudy(x));}
});
