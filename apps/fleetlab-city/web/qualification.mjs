// A separate candidate-map inspection surface; never changes recorded experiment data.
export async function mountQualification({readData, setVersion, showGap, notice, atlasGate}) {
  const $ = id => document.getElementById(id);
  const node = (tag, text) => { const e = document.createElement(tag); e.textContent = text; return e; };
  const [report, gaps, research] = await Promise.all(['qualification', 'district-gaps', 'district-research'].map(name => readData(`data/candidate-${name}.json`)));
  const transitions = report.way_transitions;
  const restored = transitions.filter(r => r.before === 'unsupported' && r.after === 'included').length;
  const blocked = transitions.filter(r => r.before === 'included' && r.after === 'unsupported').length;
  $('candidate-intro').textContent = `SF v2 models supported multi-road turn restrictions explicitly. It restores ${restored} roads; stricter parsing also blocks ${blocked} previously included roads. The same thresholds still apply. This candidate has no fleet experiment results.`;
  for (const [title, value, context] of [
    ['Unsupported eligible length', `${(report.before.unsupported_fraction*100).toFixed(2)}% → ${(report.after.unsupported_fraction*100).toFixed(2)}%`, '2% overall threshold; every road class must also pass.'],
    ['Multi-road restriction rules', String(report.restriction_counts.SUPPORTED_SEQUENCE), 'Compiled from uniquely connected source relations. Other forms stay blocked.'],
    ['District gaps to inspect', String(gaps.records.length), `${(gaps.total_gap_length_m/1000).toFixed(3)} km outside the official polygons, including sub-metre fragments.`],
  ]) { const card = node('article', ''); card.className = 'metric-tile'; card.append(node('h4',title),node('strong',value),node('p',context)); $('candidate-metrics').append(card); }
  for (const [name, after] of Object.entries(report.after.by_class)) {
    const row = node('tr', '');
    for (const value of [name.replaceAll('_',' '),`${(report.before.by_class[name].unsupported_fraction*100).toFixed(3)}%`,`${(after.unsupported_fraction*100).toFixed(3)}%`,after.unsupported_fraction<=.05?'PASS':'HOLD']) row.append(node('td',value));
    $('candidate-classes').append(row);
  }
  const ordered = [...gaps.records].sort((a,b)=>b.gap_length_m-a.gap_length_m);
  for (const [i,gap] of ordered.entries()) { const option=node('option',`${gap.name} · ${(gap.gap_length_m/1000).toFixed(3)} km · OSM ${gap.source_way_id}`); option.value=String(i); $('district-gap').append(option); }
  $('district-gap-description').textContent = 'Sorted by uncovered length. Comparing three official DataSF layers did not close these gaps. The map keeps them UNASSIGNED; a nearby district is not an assignment.';
  $('district-gap').disabled = false; $('inspect-gap').disabled = false;
  $('inspect-gap').onclick = () => { const gap=ordered[Number($('district-gap').value)]; showGap(gap); $('gap-detail').replaceChildren(node('span',`${gap.name} · ${gap.gap_length_m.toFixed(1)} m outside the layer. `)); const link=node('a','Inspect the OSM source ↗'); link.href=`https://www.openstreetmap.org/way/${encodeURIComponent(gap.source_way_id)}`; link.target='_blank';link.rel='noopener noreferrer';$('gap-detail').append(link); };
  for (const [name,label] of [['qualification','Qualification and restriction exceptions'],['district-gaps','All district-gap geometries'],['human-review','Human source-review checklist'],['district-research','Official district comparison']]) {
    const button=node('button',`${label} ↓`); button.className='text-button'; button.onclick=async()=>{try {const data=await readData(`data/candidate-${name}.json`);const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=node('a','');a.href=url;a.download=`sf-v2-${name}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){notice(e.message,true);}}; $('qualification-downloads').append(button);
  }
  $('candidate-identity').textContent = `Candidate graph: ${report.candidate_graph_digest}. Original pack: ${report.baseline_pack_digest}. Official district variants researched: ${research.datasets.map(x=>x.dataset).join(', ')}. Hashes establish internal consistency, not authenticity.`;
  async function choose(version) {
    const id=atlasGate.issue();
    $('map-version-note').textContent=`Loading ${version==='candidate'?'candidate SF v2':'recorded SF v1'} map…`;
    try {
      const roads=await readData(version==='candidate'?'data/candidate-roads.geo.json':'data/routing-roads.geo.json');
      if(!atlasGate.current(id))return;
      setVersion(version,roads);
      for(const [button,value]of [['candidate-map','candidate'],['recorded-map','recorded']])$(button).setAttribute('aria-pressed',String(version===value));
      $('map-version-note').textContent=version==='candidate'?'Viewing SF v2 candidate roads. No depot configuration or fleet run is attached. Notebook and replay remain on SF v1.':'Viewing SF v1, the exact map used by the recorded notebook and replay. Candidate changes have not been applied to those results.';
    } catch(e) {if(atlasGate.current(id)){$('map-version-note').textContent='Map switch failed; the previous map remains displayed.';notice(e.message,true);}}
  }
  $('candidate-map').disabled=false;
  $('candidate-map').onclick=()=>choose('candidate'); $('recorded-map').onclick=()=>choose('recorded');
  return report;
}
