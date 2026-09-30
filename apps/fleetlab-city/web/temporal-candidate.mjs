// Presentation of a captured engineering checkpoint, not a new experiment.
export function validateTemporalView(data, selection) {
  const fail=()=>{throw new Error('Temporal candidate evidence is incompatible');};
  const d=data, r=d?.report, e=d?.engineering, review=d?.review;
  if(d?.schema!=='fleetlab.temporal-view/1.0.0'||d.scope!=='SIMULATION_ONLY'||d.decision_authority!=='NONE'||
    d.candidate?.pack!==selection?.candidate_bundle_digest||r?.schema!=='fleetlab.temporal-map-candidate/1.0.0'||r.status!=='HOLD'||
    r.candidate_graph_digest!==d.candidate.graph||e?.pack_digest!==d.candidate.graph||e.scope!=='ONE_ENGINEERING_CASE'||
    !/^[0-9a-f]{64}$/.test(e.run_digest||'')||e.recommendation_eligible!==false||e.execution?.status!=='COMPLETE'||e.verification?.status!=='COMPLETE'||
    e.verification.valid!==true||e.verification_state!=='INTERNALLY_CONSISTENT'||e.finding_count!==0||review?.qualification!=='HOLD')fail();
  for(const value of [e.fleet_size,e.request_count,e.duration_s,e.execution.elapsed_s,e.execution.peak_rss_bytes,
    e.verification.elapsed_s,e.verification.peak_rss_bytes,review.obligation_count])if(!Number.isFinite(value)||value<=0)fail();
  for(const value of [review.human_samples?.segments,review.human_samples?.od,r.timed_turn_count,r.timed_access_count])if(!Number.isInteger(value)||value<0)fail();
  if(!Number.isFinite(r.after?.unsupported_fraction)||r.after.unsupported_fraction<0||r.after.unsupported_fraction>1)fail();
  return d;
}

export function mountTemporalProgress(host, data) {
  const n=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
  const e=data.engineering, r=data.report, review=data.review;
  host.replaceChildren();
  host.append(n('p','SF / THE NEXT GENERATION OF THE MAP','eyebrow'),n('h3','Every stop has a before and an after.'),
    n('p','A pickup, a charge or a depot visit must preserve how a vehicle arrived. The new model carries that history forward and checks time-dependent rules when the vehicle actually reaches the road.'));
  const cards=n('div','','fidelity-grid');
  for(const [title,state,copy] of [
    ['Route history survives a stop','Integrated',`One ${e.fleet_size}-vehicle, ${e.request_count.toLocaleString('en-US')}-request, ${e.duration_s/3600}-hour engineering case completed and passed independent event verification. An unavailable continuation stays unavailable.`],
    ['Access follows the clock','Time-aware',`${r.timed_turn_count} timed turn rules and ${r.timed_access_count} way-access schedules are modeled from the captured source. Supported daily, weekday and overnight rules apply at traversal time; unknown syntax remains blocked.`],
    ['People inspect the source','Review remains open',`${review.obligation_count.toLocaleString('en-US')} source and route obligations include 200 source-way samples and 100 OD pairs. Recorded human reviews: ${review.human_samples.segments} features and ${review.human_samples.od} OD cases. District scope also remains unresolved.`],
  ]) {const card=n('article','');card.append(n('span',state,'chip'),n('h4',title),n('p',copy));cards.append(card);}host.append(cards);
  const learning=n('div','','temporal-learning');
  learning.append(n('h4','What should a team take away?'),n('p','Engineering: preserve state across service boundaries. Product: keep each result tied to the map and assumptions that produced it. Operations: investigate unavailable work before interpreting a depot or capacity comparison.'));
  host.append(learning,n('p','This is one synthetic engineering check, not a new depot comparison or an operator performance estimate. The notebook and replay preserve their original recorded experiment. SF acceptance remains held.'));
  const details=n('details','');details.append(n('summary','Inspect the engineering check'));
  details.append(n('p',`Execution: ${(e.execution.elapsed_s/60).toFixed(1)} minutes, ${(e.execution.peak_rss_bytes/1e9).toFixed(3)} GB peak. Independent verification: ${e.verification.elapsed_s.toFixed(1)} seconds, ${(e.verification.peak_rss_bytes/1e9).toFixed(3)} GB peak. Both stayed within 4 GB and 30-minute phase limits.`),
    n('p','The first verifier rejected 12 numerical reconstruction mismatches. Two reproduced arithmetic defects were corrected, and the same unchanged recording then verified with zero findings. The original findings remain available in a labeled public report; its private traceback is omitted and the original file hash is retained.'),
    n('p',`Recording: ${e.run_digest}. Internally consistent; not authenticated. No operational or deployment authority.`,'small'));
  host.append(details);
  const links=n('div','','download-row');
  for(const [label,path] of [
    ['Current inspection worksheet ↓','notes/sf-temporal-inspection-worksheet.csv'],
    ['Frozen requirements ↗','data/temporal-review-requirements.json'],
    ['Engineering record ↗','notes/FLEETLAB_SF_TEMPORAL_RESOURCE_2026-09-30.md'],
    ['Map package & handoff ↗','notes/FLEETLAB_TEMPORAL_CANDIDATE_BUNDLE_V1.md'],
    ['Complete map sources ↗','/city-explorer/sources/'],
  ]) {const a=n('a',label,'text-button');a.href=path;if(path.endsWith('.csv'))a.download='sf-temporal-inspection-worksheet.csv';links.append(a);}host.append(links);
}
