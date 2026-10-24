import {setAttr} from './dom.js';
const COPY={
 paired:['One world, two arms','The difference is the change — everything else was identical.','Matching workload and travel draws; only San Francisco supply changes from 40 to 52 cars in this illustration. Pairing reduces noise; it does not remove uncertainty.'],
 guardrails:['A better average can still mean HOLD','Averages don’t govern; guardrails do.','Illustrative, rounded example: mean change in wait p90 −26 min; a 39 min guardrail value exceeds a 30 min limit, so HOLD. Check evidence validity first; a better primary result cannot override a breached, predeclared guardrail.'],
 deadhead:['The distance without a rider','Rebalancing is the art of shrinking the hollow loops.','Schematic illustration, not Waymo or R1 output: ten circuits of 10 distance units each; four circuits and half of a fifth are empty. That is 45 empty units out of 100 total, or 45%. Empty distance includes pickup travel and repositioning. Better rider coverage may require more empty travel; compare both.']
};
const clamp=n=>Math.max(0,Math.min(1,n));
export function createMethodologyExplainer(kind,doc=document){
 if(!Object.hasOwn(COPY,kind))throw new Error('Unknown explainer');
 const make=(tag,attrs={},text='',svg=false)=>{const n=svg?doc.createElementNS('http://www.w3.org/2000/svg',tag):doc.createElement(tag);for(const [k,v]of Object.entries(attrs))setAttr(n,k,v);if(text)n.textContent=text;return n;};
 const root=make('section',{class:'methodology-explainer','data-explainer-kind':kind,'aria-label':COPY[kind][0]}),svg=make('svg',{class:'explainer-stage',viewBox:'0 0 600 240','aria-hidden':'true',focusable:'false'},'',true);
 const shape=(tag,attrs,text='')=>{const n=make(tag,attrs,text,true);svg.append(n);return n;};
 const rect=(x,y,width,height,cls,extra={})=>shape('rect',{x,y,width,height,rx:6,class:cls,...extra});
 const label=(x,y,text,cls='explainer-label',extra={})=>shape('text',{x,y,class:cls,...extra},text);
 const controls=make('div',{class:'explainer-controls'}),replay=make('button',{type:'button','data-explainer-replay':''},'Replay'),pause=make('button',{type:'button','data-explainer-pause':''},'Pause'),status=make('span',{class:'explainer-status',role:'status'});
 controls.append(replay,pause,status);root.append(make('p',{class:'explainer-kicker'},'Illustration · not simulation output'),make('h3',{},COPY[kind][0]),svg,make('p',{class:'explainer-caption'},COPY[kind][1]),make('p',{class:'explainer-equivalent'},COPY[kind][2]),controls);
 let draw;
 if(kind==='paired'){
 rect(220,8,160,40,'explainer-track');label(300,35,'Same seed S','explainer-label',{'text-anchor':'middle'});
 shape('path',{d:'M237 28H108V145M108 91H125M108 145H125',class:'explainer-connector',fill:'none'});
 label(140,72,'Matching workload + travel draws','explainer-small');
 const lanes=[91,145].map((y,i)=>{label(16,y+14,`Arm ${i?'B':'A'}`);rect(125,y,300,20,'explainer-track');return rect(125,y,300,20,'explainer-fill',{'data-paired-lane':i});});
 label(450,108,'40 cars');const supply=label(450,162,'52 cars','explainer-value',{'data-paired-supply':''}),delta=label(300,215,'+12 cars · one supply change','explainer-value',{'text-anchor':'middle'});
 draw=p=>{for(const lane of lanes)lane.setAttribute('width',300*clamp(p/.4));supply.textContent=p<.55?'40 cars':'52 cars';delta.setAttribute('opacity',clamp((p-.7)/.3));};
 }else if(kind==='guardrails'){
 const wash=rect(0,0,600,240,'explainer-wash');
 label(22,40,'Mean change in wait p90');label(470,40,'−26 min','explainer-value');rect(22,56,390,23,'explainer-track');const primary=rect(22,56,390,23,'explainer-fill');
 label(22,120,'Guardrail value');label(305,120,'39 min','explainer-value');rect(22,137,390,23,'explainer-track');const guard=rect(22,137,304.2,23,'explainer-danger',{'data-guardrail-bar':''});
 shape('line',{x1:256,x2:256,y1:129,y2:177,class:'explainer-limit'});label(256,201,'30 min limit','explainer-small',{'text-anchor':'middle'});
 const verdict=shape('g',{class:'explainer-hold'});verdict.append(make('rect',{x:440,y:130,width:138,height:58,rx:12,class:'explainer-danger'},'',true),make('text',{x:509,y:168,'text-anchor':'middle',class:'explainer-verdict'},'HOLD',true));
 draw=p=>{primary.setAttribute('width',390*clamp(p/.3));const width=304.2*clamp((p-.3)/.5),reveal=p===1?1:clamp((p-.8)/.2);guard.setAttribute('width',width);guard.setAttribute('class',width>234?'explainer-danger':'explainer-warning');wash.setAttribute('opacity',.4*reveal);verdict.setAttribute('opacity',reveal);verdict.setAttribute('transform',`translate(0 ${8*(1-reveal)})`);};
 }else{
 rect(80,60,270,130,'explainer-block',{rx:0});label(215,120,'One circuit','explainer-label',{'text-anchor':'middle'});label(215,145,'10 distance units','explainer-small',{'text-anchor':'middle'});
 const car=shape('g',{'data-car':''});car.append(make('rect',{x:-19,y:-11,width:38,height:22,rx:7,class:'explainer-car'},'',true));
 for(const x of [-11,11])for(const y of [-13,13])car.append(make('circle',{cx:x,cy:y,r:4,class:'explainer-wheel'},'',true));
 const total=label(390,78,'100 units','explainer-value'),empty=label(390,120,'45 empty','explainer-value'),share=label(390,162,'45% empty','explainer-value',{'data-empty-share':''});
 label(390,192,'Distance units','explainer-small');
 for(let i=0;i<10;i++){rect(28+i*55,218,42,10,i<5?'explainer-empty':'explainer-fill');if(i===4)rect(28+i*55+21,218,21,10,'explainer-fill',{rx:0});}
 draw=p=>{const d=p*100,e=Math.min(45,d),pos=(p*10%1)*800;let x,y,angle;if(pos<270){x=80+pos;y=60;angle=0;}else if(pos<400){x=350;y=60+pos-270;angle=90;}else if(pos<670){x=350-(pos-400);y=190;angle=180;}else{x=80;y=190-(pos-670);angle=270;}car.setAttribute('transform',`translate(${x} ${y}) rotate(${angle})`);car.setAttribute('data-empty',String(d<45));total.textContent=`${d.toFixed(0)} units`;empty.textContent=`${e.toFixed(0)} empty`;share.textContent=d?`${Math.round(e/d*100)}% empty`:'No distance';root.setAttribute('data-total-distance',String(d));root.setAttribute('data-empty-distance',String(e));};
 }
 const win=doc.defaultView,media=win?.matchMedia?.('(prefers-reduced-motion: reduce)'),duration=kind==='deadhead'?16000:1800;
 let frame=null,elapsed=0,last=null,observer=null,listening=false,state='idle';
 const reduced=()=>media?.matches||doc.documentElement.dataset.motion==='reduce';
 const blocked=()=>doc.documentElement.dataset.visitorMotion==='paused';
 const unavailable=()=>!root.isConnected||doc.hidden||root.closest('[hidden]');
 const setState=(next,message)=>{state=next;root.setAttribute('data-explainer-state',next);status.textContent=message;pause.textContent=next==='paused'?'Resume':'Pause';pause.disabled=next!=='playing'&&next!=='paused';};
 const cancel=()=>{if(frame!==null)win.cancelAnimationFrame(frame);frame=null;last=null;};
 const cleanup=()=>{cancel();observer?.disconnect();observer=null;if(listening){media?.removeEventListener?.('change',check);doc.removeEventListener('visibilitychange',check);win.removeEventListener('hashchange',finish);win.removeEventListener('pagehide',finish);listening=false;}};
 function finish(){cleanup();draw(1);setState('complete','Illustration complete.');}
 function stop(){cancel();setState('paused','Illustration paused.');}
 function check(){if(unavailable()||reduced())finish();else if(blocked()&&state==='playing')stop();}
 function tick(now){frame=null;if(unavailable()||reduced()){finish();return;}if(blocked()){stop();return;}if(last!==null)elapsed+=Math.max(0,now-last);last=now;draw(clamp(elapsed/duration));if(elapsed>=duration)finish();else frame=win.requestAnimationFrame(tick);}
 function listen(){if(listening)return;listening=true;media?.addEventListener?.('change',check);doc.addEventListener('visibilitychange',check);win.addEventListener('hashchange',finish);win.addEventListener('pagehide',finish);if(win.MutationObserver){observer=new win.MutationObserver(check);observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','data-motion','data-visitor-motion']});}}
 replay.addEventListener('click',()=>{cleanup();elapsed=0;if(unavailable()||reduced()||blocked()||!win?.requestAnimationFrame){finish();return;}draw(0);listen();setState('playing','Playing illustration.');frame=win.requestAnimationFrame(tick);});
 pause.addEventListener('click',()=>{if(state==='playing')stop();else if(state==='paused'){if(unavailable()||reduced()){finish();return;}if(blocked()){status.textContent='Resume site motion first.';return;}setState('playing','Playing illustration.');frame=win.requestAnimationFrame(tick);}});
 draw(1);setState('idle','Static. Replay to watch.');return root;
}
