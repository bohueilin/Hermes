/** Reproduce a frozen Bay paired comparison locally. Output is teaching data, NOT_EVIDENCE. */
import {advancedOperationsDemoConfig,freezeBayExperiment,bayExperimentSteps} from '../src/model/bay-experiment-contract.js';
const kinds={charging_redistribution:'charging',charging_deadlines:'charging',resource_freshness:'resources',airport_forecast:'airport'};
const treatment=process.argv[2]??'charging_redistribution';
if(!Object.hasOwn(kinds,treatment)){process.stderr.write('Choose charging_redistribution, charging_deadlines, resource_freshness or airport_forecast.\n');process.exitCode=2;}
else {
  const options={treatment};if(process.argv[3])options.seeds=process.argv[3].split(',').map(Number);
  try {
    const frozen=freezeBayExperiment(advancedOperationsDemoConfig(kinds[treatment]),options),steps=bayExperimentSteps(frozen);
    for(;;){const next=steps.next();if(next.done){process.stdout.write(JSON.stringify(next.value,null,2)+'\n');if(next.value.validity!=='VALID')process.exitCode=1;break;}}
  }catch(error){process.stderr.write(error.message+'\n');process.exitCode=2;}
}
