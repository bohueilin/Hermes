// Reviewed navigation taxonomy, not model metadata or an evidence classification.
// Every existing catalogue ID has one primary home. No keyword guessing.
export const QUESTION_FAMILIES = [
 {id:'depot',title:'Depot operations',question:'What keeps a parked car waiting?',tile:'T-07-depot-ops.webp',lessons:['two-vehicles','depot-count','cleaning','staffing-readiness','OPS-11','OPS-12','OPS-19','OPS-20']},
 {id:'energy',title:'Charging & energy',question:'Would more chargers actually help?',tile:'T-08-charging-energy.webp',lessons:['charging','shared-power','power-redistribution','deadline-charging','resource-freshness']},
 {id:'data',title:'Data movement',question:'Whose work should go first?',tile:'T-09-data-movement.webp',lessons:['crossed-priorities','software','upload']},
 {id:'streets',title:'Streets & queues',question:'Can one slow block hold up a fleet?',tile:'T-10-streets-queues.webp',lessons:['bay-area','street-first','street-harrison','street-stockton','street-van-ness','street-embarcadero','street-lombard','UC-05','OPS-17']},
 {id:'demand',title:'Demand & weather',question:'What changes when demand surges?',tile:'T-11-demand-weather.webp',lessons:['weather-day','rush-hour','airport-preparation','L1','OPS-09','OPS-13','OPS-14','OPS-15','OPS-16']},
 {id:'scale',title:'Fleet scale',question:'When do more vehicles help?',tile:'T-12-fleet-scale.webp',lessons:['vehicle-mix','fleet-day','density-ladder','response-reserve','UC-02','OPS-01','OPS-10','OPS-18']},
 // These lessons explicitly compare one declared change; other families also contain paired studies.
 {id:'paired',title:'Paired experiments',question:'Did the change make a difference?',tile:'T-13-paired-experiments.webp',lessons:['L2a','L2b','UC-08a','UC-08b','UC-10']},
 {id:'reading',title:'Reading a result',question:'What can this result really tell us?',tile:'T-14-reading-result.webp',lessons:['full-cycle','bay_teaching_map','UC-01','UC-03']},
 {id:'launch',title:'Launch & recall',question:'When should vehicles enter service?',tile:'T-15-launch-recall.webp',lessons:['region-launch','fleet-intake','L3','OPS-02','OPS-03','OPS-04','OPS-05','OPS-06','OPS-07','OPS-08']},
];
