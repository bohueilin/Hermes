export function mountQualificationProgress(host, envelope) {
  if(envelope?.schema!=='fleetlab.map-review-envelope/1.0.0'||envelope.qualification!=='HOLD'||envelope.scope!=='SIMULATION_ONLY'||envelope.deployment_permission!=='NONE')throw new Error('SF readiness projection is incompatible');
  const n=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
  host.replaceChildren();host.append(n('p','SF COMPLETION / THE NEXT REVIEW','eyebrow'),n('h3','What is ready, and what still needs evidence.'));
  const cards=n('div','','fidelity-grid');
  for(const [title,state,copy] of [
    ['Carry the route through a stop','Standalone module','The new router preserves arrival history across pickup and depot stops. Fixture tests cover forbidden turns, zero-length legs and unfinished paths. Fleet-engine integration and SF performance qualification remain open.'],
    ['Respect time-dependent access','Standalone parser','Daily, weekday and overnight restrictions now have a bounded timestamp evaluator. The existing candidate map is unchanged; routing still needs this temporal integration.'],
    ['Inspect the captured source','Review package ready',`${Object.keys(envelope.obligations).length.toLocaleString('en-US')} obligations cover the exception queues plus a fixed 200-feature / 100-OD sample. Recorded human feature reviews: ${envelope.human_samples.segments}; OD reviews: ${envelope.human_samples.od}.`],
  ]) {const card=n('article','');card.append(n('span',state,'chip'),n('h4',title),n('p',copy));cards.append(card);}host.append(cards);
  host.append(n('p','SF acceptance remains held. All 108 district gaps remain UNASSIGNED. Required human inspection, fleet continuity and map budgets must be resolved together; a better-looking map or passing code tests cannot substitute for them.'));
  const links=n('div','','download-row');
  for(const [label,path] of [['Inspection worksheet ↓','notes/sf-inspection-worksheet.csv'],['Frozen sample & requirements ↗','data/sf-review-requirements.json'],['SF completion & next-city handoff ↗','notes/FLEETLAB_SF_COMPLETION_STATUS_2026-09-29.md'],['Five-visitor session guide ↗','notes/FLEETLAB_SF_VALIDATION_SESSION.md']]){const a=n('a',label,'text-button');a.href=path;if(path.endsWith('.csv'))a.download='sf-inspection-worksheet.csv';links.append(a);}host.append(links);
}
