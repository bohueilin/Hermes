// Incomplete execution is a status, never a reduced experiment population.
export function validateStoppedStudy(data) {
  const arms = ['a-200','ab-200','b-200','a-400','ab-400','b-400'];
  if(data?.schema!=='fleetlab.power-status/1.0.0'||data.analysis_status!=='INCOMPLETE'||data.primary!==null||data.scope!=='SIMULATION_ONLY'||data.decision_authority!=='NONE'||!data.failure?.detail)throw new Error('Incompatible stopped-study status');
  if(!Array.isArray(data.seeds)||data.seeds.length!==24||new Set(data.seeds).size!==24||data.seeds.some(s=>!Number.isSafeInteger(s)))throw new Error('Stopped-study seed population is incomplete');
  const expected=data.seeds.flatMap(seed=>arms.map(arm=>`${seed}/${arm}`));
  if(!Array.isArray(data.cells)||data.cells.length!==144||data.cells.some((c,i)=>`${c.seed}/${c.arm}`!==expected[i]||!['RECORDED','NOT_RUN'].includes(c.status)))throw new Error('Stopped-study cell population differs');
  const count=data.cells.filter(c=>c.status==='RECORDED').length;
  if(count>=144||data.completed_arms!==count||data.scheduled_arms!==144||data.not_run_arms!==144-count||data.cells.some((c,i)=>c.status!==(i<count?'RECORDED':'NOT_RUN')))throw new Error('Stopped-study counts differ');
  return data;
}

export function renderStoppedStudy(host, raw) {
  const data=validateStoppedStudy(raw);
  const n=(tag,text,cls)=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;};
  host.replaceChildren();host.hidden=false;
  host.append(n('p','NEXT EXPERIMENT / EXECUTION HELD','eyebrow'),n('h3','More charging power is still an open question.'));
  host.append(n('p',`The six-configuration power study stopped after ${data.completed_arms} of ${data.scheduled_arms} evaluation runs. Its full paired comparison is unavailable. The original twelve-pair study below remains inspectable.`));
  const fact=n('p',`Stop: ${data.failure.detail}. ${data.not_run_arms} scheduled runs were not performed. No missing result is replaced, estimated or counted as zero.`,'small');host.append(fact);
  const detail=n('details','');detail.append(n('summary','Inspect the retained execution status'));
  detail.append(n('p','This is execution evidence, not evidence for a depot decision. A completed arm does not satisfy the predeclared 24 complete six-arm blocks.'));
  const pre=n('pre','');pre.append(n('code',JSON.stringify(data,null,2)));detail.append(pre);host.append(detail);
}
