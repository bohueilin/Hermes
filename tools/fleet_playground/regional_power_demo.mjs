/** Local synthetic rehearsal. Does not write Hermes evidence or publish anything. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {regionalPowerDemoConfig,POWER_CONDITIONS} from '../../playground/fleetlab/src/model/regional-power.js';
import {AUSTIN_REGION} from '../../playground/fleetlab/src/model/region-package.js';
import {simulateBayAreaOperations} from '../../playground/fleetlab/src/model/bay-operations.js';
import {freezeBayExperiment,bayExperimentSteps} from '../../playground/fleetlab/src/model/bay-experiment-contract.js';
import {createSetup,encodeSetup} from '../../playground/fleetlab/src/ui/setup-codec.js';

const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--out')throw new Error('Usage: node tools/fleet_playground/regional_power_demo.mjs --out artifacts/fleetlab-regional-power/demo');
const out=resolve(args[1]);mkdirSync(out,{recursive:true});
const write=(name,record)=>writeFileSync(join(out,name),JSON.stringify(record,null,2)+'\n');
const source={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim().length>0};
const results=[];
for(const condition of POWER_CONDITIONS){
  const config=regionalPowerDemoConfig(condition.id),options={treatment:'charging_deadlines',seeds:Array.from({length:12},(_,i)=>1001+i),tuning_seeds:[42,43,44],margin:.02,resamples:2000,null_treatment:false};
  const frozen=freezeBayExperiment(config,options),steps=bayExperimentSteps(frozen);let next;
  do{next=steps.next();}while(!next.done);
  const experiment=next.value;write(`${condition.id}-experiment.json`,experiment);
  const setup=createSetup({model:'regional-power',config,options});write(`${condition.id}-setup.json`,setup);
  writeFileSync(join(out,`${condition.id}-setup-fragment.txt`),'#/fleet-day?setup='+encodeSetup(setup)+'\n');
  results.push({condition:condition.id,digest:experiment.digest,validity:experiment.validity,primary:experiment.analysis?.primary??null,
    outcome:experiment.analysis?.outcome??null,recommendation:experiment.analysis?.recommendation??null,guardrails:experiment.analysis?.guardrail_statuses??null});
}
const demo=simulateBayAreaOperations(regionalPowerDemoConfig());write('development-seed-42-run.json',demo);
const report={format:'fleetlab-regional-power-local-rehearsal',source,region:AUSTIN_REGION,evidence_status:'NOT_EVIDENCE',deployment_permission:'NONE',scope:'simulation-only',
  development_seed:42,evaluation_seeds:Array.from({length:12},(_,i)=>1001+i),tuned_on_evaluation_seeds:false,
  primary_arms:96,repeatability_probe_arms:16,development_arms:1,results,
  limitations:['Synthetic, uncalibrated conditions; no real operating or safety conclusion.','Completion remains the existing registered primary. No new all-request pickup metric.','Source is the base commit plus uncommitted working changes when dirty; hashes identify configurations, not authenticated evidence.']};
write('observed-results.json',report);
console.log(JSON.stringify(report,null,2));
