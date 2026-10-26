import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installFakeDom} from './helpers/fake-dom.mjs';import {ORDER_STUDY} from '../src/data/delivery-order-study.js';
import {reconstructOrderStudy} from '../src/runtime/delivery-order-worker.js';import {createOrderPage} from '../src/ui/delivery-order-page.js';
// Step B C7: the Delivery Order states (docs/FLEETLAB_NETWORK_FLOWS_STEP_B_PLAN_2026-10-26.md section 4, owner decision D5).
// Badges are separate elements: [data-figures] labels the outcome cards, [data-pending] the editor, [data-unavailable] a failed check.
const FIGS={default:'2/4 · 178 s · 138 s · 378 s',impossible:'1/4 · 192 s · 138 s · 378 s',close:'2/4 · 4 s · 2 s · 378 s',best:'4/4 · 0 s · 0 s · 378 s',closeBest:'3/4 · 50 s · 50 s · 378 s'};
const NAMES={default:'Different targets',impossible:'One impossible target',close:'Close targets'};
const IDLE='Published summary · no calculation has started.',PENDING='Your edited order is pending';
const setup=(t,extra={})=>{const restore=installFakeDom();t.after(restore);const p=createOrderPage({manifest:ORDER_STUDY,runStudy:async e=>reconstructOrderStudy(e),...extra});document.body.appendChild(p.element);t.after(()=>p.destroy());return p;};
const never=()=>{throw Error('must not run');};
// Always queried fresh, never captured before the action under test.
const cards=p=>[...p.element.querySelectorAll('.outcome-grid article')].slice(0,2);
const shown=a=>{const d=a.querySelector('dl').children;return [a.querySelector('.big-count').textContent,d[1].textContent,d[3].textContent,d[5].textContent].join(' · ');};
const eyebrows=p=>cards(p).map(a=>a.querySelector('.eyebrow').textContent);
const one=(p,s)=>{const n=p.element.querySelectorAll(s);assert.equal(n.length,1,s);return n[0];};
const badge=(p,name)=>{const b=one(p,`[data-${name}]`);assert.equal(b.localName,'span');assert.equal(b.getAttribute('class'),'badge');return b.hidden?null:b.textContent;};
const status=p=>one(p,'[data-status]').textContent,resultCase=p=>one(p,'[data-result-case]').textContent,said=p=>one(p,'p.sr-only[role="status"]').textContent;
const button=(p,name)=>[...p.element.querySelectorAll('button')].find(b=>b.textContent===name);
// Every visible text run and every attribute value, so a pending claim cannot hide in an aria-label.
const words=p=>[p.element.textContent,...[...p.element.querySelectorAll('*')].flatMap(n=>n.getAttributeNames().map(a=>n.getAttribute(a)))].join('\n');
const failing=reason=>async e=>reason==='Checked study identity unavailable.'?{...reconstructOrderStudy(e),verification:{ok:false}}:Promise.reject(Error(reason));

test('first paint: published figures labelled Published order, no pending language anywhere, primary is Compare my order',t=>{
 const p=setup(t,{runStudy:never});
 assert.deepEqual(cards(p).map(shown),[FIGS.default,FIGS.default]);assert.deepEqual(eyebrows(p),['First come','Your order']);
 assert.equal(badge(p,'figures'),'Published order');assert.equal(badge(p,'pending'),null);assert.equal(badge(p,'unavailable'),null);
 assert.ok(!one(p,'.outcome-grid').contains(one(p,'[data-figures]')),'the badge never sits inside a card');assert.ok(one(p,'.result-panel').contains(one(p,'[data-figures]')));
 assert.ok(one(p,'.decision-panel').contains(one(p,'[data-unavailable]')));const kids=one(p,'[data-status]').parentElement.children;assert.ok(kids[kids.indexOf(one(p,'[data-status]'))+1]===one(p,'[data-unavailable]'),'the reason sits right after the status line');
 assert.doesNotMatch(words(p),/pending/i);assert.equal(status(p),IDLE);
 assert.equal(resultCase(p),'Different targets · published summary');assert.equal(one(p,'.outcome-note').textContent,'');
 assert.equal(cards(p)[1].querySelector('.fine').textContent,'Your order starts as First come. Move a vehicle, then choose Compare my order.');
 assert.equal(one(p,'button.primary').textContent,'Compare my order');assert.ok(button(p,'Reset to First come'));
 assert.equal(one(p,'.order-editor').getAttribute('aria-label'),'Your service order');assert.equal(p.getState().mode,null);
});
test('a real re-render: a pre-run scenario switch replaces the cards with that scenario\'s own published First come figures',t=>{
 const p=setup(t,{runStudy:never});
 for(const id of ['close','impossible','default']){
  const before=cards(p);p.selectCase(id);const now=cards(p);
  assert.ok(now.every(a=>a.isConnected&&!before.includes(a)),`${id}: cards were re-rendered`);assert.ok(before.every(a=>!a.isConnected),`${id}: old cards left the page`);
  assert.deepEqual(now.map(shown),[FIGS[id],FIGS[id]],id);assert.equal(resultCase(p),`${NAMES[id]} · published summary`);
  assert.equal(badge(p,'figures'),'Published order');assert.equal(badge(p,'pending'),null);assert.equal(status(p),IDLE);
  assert.doesNotMatch(words(p),/pending/i);
 }
});
test('an edit before any check keeps the published figures in fresh cards, badges the editor, and Reset to First come clears it',t=>{
 const p=setup(t,{runStudy:never});p.selectCase('close');
 p.move('V4',-1);
 assert.deepEqual(cards(p).map(shown),[FIGS.close,FIGS.close]);assert.equal(badge(p,'figures'),'Published order');
 assert.equal(badge(p,'pending'),PENDING);assert.ok(one(p,'.edit-status').contains(one(p,'[data-pending]')));assert.match(one(p,'.edit-status').textContent,/^Selected: Close targets\. /);
 button(p,'Reset to First come').click();assert.equal(badge(p,'pending'),null);assert.deepEqual(p.getState().pendingOrder,['V1','V2','V3','V4']);
 // Close targets' earliest-target order is First come itself, so it is not an edit; One impossible target's is.
 button(p,'Try earliest target').click();assert.equal(badge(p,'pending'),null);
 p.selectCase('impossible');button(p,'Try earliest target').click();assert.deepEqual(p.getState().pendingOrder,['V1','V4','V3','V2']);assert.equal(badge(p,'pending'),PENDING);
 assert.deepEqual(cards(p).map(shown),[FIGS.impossible,FIGS.impossible]);
});
test('pending is per scenario: an unedited scenario switch never says edited, before or after a check',async t=>{
 const p=setup(t);
 p.selectCase('close');p.selectCase('default');assert.equal(badge(p,'pending'),null);
 assert.equal(await p.load(),true);assert.equal(badge(p,'pending'),null);
 p.selectCase('close');assert.equal(badge(p,'pending'),null,'switch after acceptance');assert.equal(status(p),'Checked Different targets retained. Compare to accept Close targets.');
 assert.equal(resultCase(p),'Different targets · checked complete study');assert.deepEqual(cards(p).map(shown),[FIGS.default,FIGS.default]);
 p.move('V4',-1);assert.equal(badge(p,'pending'),PENDING,'a real edit in the switched scenario');
 p.selectCase('impossible');assert.equal(badge(p,'pending'),null);p.selectCase('default');assert.equal(badge(p,'pending'),null);
 p.move('V4',-1);assert.equal(badge(p,'pending'),PENDING);button(p,'Reset to First come').click();assert.equal(badge(p,'pending'),null,'back to the compared order');
});
test('pending follows the last compared order: Compare, Best of 24 and the worked example never mark an unedited editor',async t=>{
 const p=setup(t);
 assert.equal(await p.load(),true);assert.equal(p.getState().mode,'user');assert.equal(badge(p,'figures'),'Your order');assert.equal(badge(p,'pending'),null);
 p.move('V4',-1);assert.equal(badge(p,'pending'),PENDING);assert.equal(badge(p,'figures'),'Your order');assert.deepEqual(cards(p).map(shown),[FIGS.default,FIGS.default]);
 assert.equal(await p.showBest(),true);assert.equal(p.getState().mode,'best');assert.equal(badge(p,'figures'),'Best of 24');assert.equal(badge(p,'pending'),null);
 assert.deepEqual(eyebrows(p),['First come','Best permitted order']);assert.deepEqual(cards(p).map(shown),[FIGS.default,FIGS.best]);
 // An edit after a checked Best of 24 badges the editor; the checked best figures keep their own label.
 p.move('V1',1);assert.equal(badge(p,'pending'),PENDING);assert.equal(badge(p,'figures'),'Best of 24');assert.deepEqual(cards(p).map(shown),[FIGS.default,FIGS.best]);
 await p.watchExample();assert.equal(p.getState().mode,'example');assert.equal(badge(p,'figures'),'Worked example');assert.equal(badge(p,'pending'),null);
 assert.deepEqual(eyebrows(p),['First come','Best permitted order']);assert.deepEqual(cards(p).map(shown),[FIGS.default,FIGS.best]);
 p.restoreOrder();assert.equal(p.getState().mode,'user');assert.equal(badge(p,'figures'),'Your order');assert.equal(badge(p,'pending'),null);
 assert.equal(status(p),'Checked Different targets restored.');assert.deepEqual(eyebrows(p),['First come','Your order']);
});
test('a successful check: exact status, result case and mode badge for each mode',async t=>{
 for(const [mode,run,label]of [['user',p=>p.load(),'Your order'],['best',p=>p.showBest(),'Best of 24'],['example',p=>p.watchExample(),'Worked example']])await t.test(mode,async t=>{
  const p=setup(t);p.selectCase('close');await run(p);const id=mode==='example'?'default':'close';
  assert.equal(status(p),`Checked 24 of 24 permitted orders · ${NAMES[id]}.`);assert.equal(resultCase(p),`${NAMES[id]} · checked complete study`);
  assert.equal(badge(p,'figures'),label);assert.equal(badge(p,'unavailable'),null);assert.equal(p.getState().mode,mode);
 });
});
const REASONS=['Checked study identity unavailable.','Computation timed out.','The lesson worker could not finish. Try again.','Returned record rejected: incomplete-coverage','Returned study identity mismatch.','Study rejected: incomplete-coverage','Published study identity or metric mismatch.','Published input identity mismatch.'];
test('a first-run failure names the reason, keeps the published figures, never claims anything was retained, and is announced',async t=>{
 for(const reason of REASONS)await t.test(reason,async t=>{
  const p=setup(t,{runStudy:failing(reason)});p.selectCase('impossible');assert.equal(await p.load(),false);
  const line='Unable to accept this comparison. Published summary remains available.';
  assert.equal(status(p),line);assert.doesNotMatch(status(p),/retained/);assert.equal(said(p),`${line} Unavailable: ${reason}`);
  assert.equal(badge(p,'unavailable'),`Unavailable: ${reason}`);assert.equal(badge(p,'figures'),'Published order');
  // The label keeps the small-caps style; the reason sits in its own span, set in sentence case.
  const u=one(p,'[data-unavailable]');assert.deepEqual(u.childNodes.map(n=>n.nodeType===3?n.textContent:n.localName),['Unavailable: ','span']);assert.equal(u.children[0].textContent,reason);
  assert.deepEqual(cards(p).map(shown),[FIGS.impossible,FIGS.impossible]);assert.equal(resultCase(p),'One impossible target · published summary');
  assert.equal(p.getState().acceptedCase,null);assert.equal(p.getState().mode,null);
  p.selectCase('close');assert.equal(badge(p,'unavailable'),null,'a new choice clears the reason');assert.equal(status(p),IDLE);
 });
});
test('a worked example that fails before any check shows the default published figures it switched to',async t=>{
 const p=setup(t,{runStudy:failing('Computation timed out.')});p.selectCase('close');assert.deepEqual(cards(p).map(shown),[FIGS.close,FIGS.close]);await p.watchExample();
 assert.equal(p.getState().pendingCase,'default');assert.equal(resultCase(p),'Different targets · published summary');assert.deepEqual(cards(p).map(shown),[FIGS.default,FIGS.default]);
 assert.equal(status(p),'Unable to accept this comparison. Published summary remains available.');
 assert.equal(badge(p,'unavailable'),'Unavailable: Computation timed out.');assert.equal(badge(p,'figures'),'Published order');assert.equal(badge(p,'pending'),null);
});
test('a worked example that fails after an earlier check restores that scenario, so the editor and the cards agree',async t=>{
 let fail=false;const p=setup(t,{runStudy:async e=>{if(fail)throw Error('Computation timed out.');return reconstructOrderStudy(e);}});
 p.selectCase('close');p.move('V3',-1);assert.equal(await p.showBest(),true);const compared=p.getState().savedOrder;
 fail=true;assert.equal(await p.watchExample(),undefined);const s=p.getState();
 assert.equal(s.acceptedCase,'close');assert.equal(s.pendingCase,'close');assert.deepEqual(s.pendingOrder,compared);assert.equal(s.mode,'best');
 assert.equal(one(p,'.edit-status').textContent,'Selected: Close targets. ');assert.equal(badge(p,'pending'),null);
 assert.equal(one(p,'[data-case="close"]').getAttribute('aria-pressed'),'true');assert.equal(one(p,'[data-case="default"]').getAttribute('aria-pressed'),'false');
 assert.equal(resultCase(p),'Close targets · checked complete study');assert.deepEqual(cards(p).map(shown),[FIGS.close,FIGS.closeBest]);assert.equal(badge(p,'figures'),'Best of 24');
 assert.equal(status(p),'Unable to accept this comparison. Previous accepted outcomes are retained.');assert.equal(badge(p,'unavailable'),'Unavailable: Computation timed out.');
 assert.equal(said(p),'Unable to accept this comparison. Previous accepted outcomes are retained. Unavailable: Computation timed out.');
});
test('a failure after acceptance keeps the checked figures and their label; the next success clears the reason',async t=>{
 let fail=false;const p=setup(t,{runStudy:async e=>{if(fail)throw Error('Computation timed out.');return reconstructOrderStudy(e);}});
 await p.showBest();fail=true;p.selectCase('close');assert.equal(await p.load(),false);
 assert.equal(status(p),'Unable to accept this comparison. Previous accepted outcomes are retained.');assert.equal(badge(p,'unavailable'),'Unavailable: Computation timed out.');
 assert.equal(p.getState().pendingCase,'close','a compare in the visitor\'s own scenario keeps that choice');
 assert.equal(resultCase(p),'Different targets · checked complete study');assert.equal(badge(p,'figures'),'Best of 24');assert.deepEqual(cards(p).map(shown),[FIGS.default,FIGS.best]);
 fail=false;assert.equal(await p.load(),true);assert.equal(badge(p,'unavailable'),null);assert.equal(badge(p,'figures'),'Your order');
});
test('Cancel before and after acceptance is announced; a cancelled computation is swallowed, never shown as unavailable',async t=>{
 let reject=null,instant=false;const p=setup(t,{runStudy:e=>instant?Promise.resolve(reconstructOrderStudy(e)):new Promise((r,j)=>{reject=j;})});
 const first=p.load();p.cancel();reject(Error('Computation cancelled.'));assert.equal(await first,false);
 assert.equal(status(p),'Check cancelled. Published summary remains available.');assert.equal(said(p),'Check cancelled. Published summary remains available.');
 assert.equal(badge(p,'unavailable'),null);assert.equal(badge(p,'figures'),'Published order');assert.equal(p.getState().mode,null);
 instant=true;assert.equal(await p.load(),true);instant=false;
 p.selectCase('close');const second=p.load();p.cancel();reject(Error('Computation cancelled.'));assert.equal(await second,false);
 assert.equal(status(p),'Check cancelled. Previous accepted outcomes are retained.');assert.equal(said(p),'Check cancelled. Previous accepted outcomes are retained.');
 assert.equal(badge(p,'unavailable'),null);assert.equal(badge(p,'figures'),'Your order');assert.equal(resultCase(p),'Different targets · checked complete study');
});
// A worked example switches the editor to Different targets; cancelling or suspending it after a check returns the
// editor to the checked scenario and its last compared order, as a failure does, so the editor and the cards agree.
for(const [stop,line]of [['cancel','Check cancelled. Previous accepted outcomes are retained.'],['suspend','Checked 24 orders retained · playback paused.']])
test(`${stop} during a worked example after an earlier check restores that scenario, so the editor and the cards agree`,async t=>{
 let reject=null,hold=false;const p=setup(t,{runStudy:e=>hold?new Promise((r,j)=>{reject=j;}):Promise.resolve(reconstructOrderStudy(e))});
 p.selectCase('close');p.move('V3',-1);assert.equal(await p.showBest(),true);const compared=p.getState().savedOrder;
 hold=true;const example=p.watchExample();assert.equal(p.getState().pendingCase,'default');assert.equal(p.getState().loading,true);
 p[stop]();reject(Error('Computation cancelled.'));assert.equal(await example,undefined);const s=p.getState();
 assert.equal(s.loading,false);assert.equal(s.acceptedCase,'close');assert.equal(s.pendingCase,'close');assert.deepEqual(s.pendingOrder,compared);assert.equal(s.mode,'best');
 assert.equal(one(p,'.edit-status').textContent,'Selected: Close targets. ');assert.equal(badge(p,'pending'),null);
 assert.equal(one(p,'[data-case="close"]').getAttribute('aria-pressed'),'true');assert.equal(one(p,'[data-case="default"]').getAttribute('aria-pressed'),'false');
 assert.equal(resultCase(p),'Close targets · checked complete study');assert.deepEqual(cards(p).map(shown),[FIGS.close,FIGS.closeBest]);assert.equal(badge(p,'figures'),'Best of 24');
 assert.equal(status(p),line);assert.equal(badge(p,'unavailable'),null);
});
test('a worked example cancelled before any check stays on the Different targets it switched to',async t=>{
 let reject=null;const p=setup(t,{runStudy:()=>new Promise((r,j)=>{reject=j;})});p.selectCase('close');
 const example=p.watchExample();p.cancel();reject(Error('Computation cancelled.'));assert.equal(await example,undefined);
 assert.equal(p.getState().pendingCase,'default');assert.equal(resultCase(p),'Different targets · published summary');assert.deepEqual(cards(p).map(shown),[FIGS.default,FIGS.default]);
 assert.equal(status(p),'Check cancelled. Published summary remains available.');
});
// Moving a vehicle while a check runs cancels it. The page is left exactly as Cancel leaves it in the same situation,
// except that the editor keeps the scenario being edited and shows the moved order, badged by that scenario's own rule.
const left=p=>({status:status(p),said:said(p),figures:badge(p,'figures'),unavailable:badge(p,'unavailable'),resultCase:resultCase(p),cards:cards(p).map(shown),mode:p.getState().mode,loading:p.getState().loading,cancelRow:!button(p,'Cancel check').hidden,compare:!one(p,'button.primary').disabled});
const RETAINED='Check cancelled. Previous accepted outcomes are retained.',PUBLISHED='Check cancelled. Published summary remains available.';
for(const [during,prep,start,[id,dir],line,pending]of [
 ['a Compare before any check',()=>{},p=>p.load(),['V4',-1],PUBLISHED,PENDING],
 // The move returns Close targets to its published order, which is not an edit.
 ['a Compare after an accepted check',async p=>{await p.showBest();p.selectCase('close');p.move('V4',-1);},p=>p.load(),['V4',1],RETAINED,null],
 ['a worked example before any check',p=>p.selectCase('close'),p=>p.watchExample(),['V1',1],PUBLISHED,PENDING],
 // Cancel would return the editor to Close targets; the move stays on the Different targets being edited.
 ['a worked example after an accepted check',async p=>{p.selectCase('close');p.move('V3',-1);await p.showBest();},p=>p.watchExample(),['V4',-1],RETAINED,PENDING]])
test(`moving a vehicle during ${during} leaves the page as Cancel does and keeps the moved order in its own scenario`,async t=>{
 const held=async(t,act)=>{let reject=null,hold=false;const p=setup(t,{runStudy:e=>hold?new Promise((r,j)=>{reject=j;}):Promise.resolve(reconstructOrderStudy(e))});
  await prep(p);hold=true;const flight=start(p),before=p.getState();assert.equal(before.loading,true);
  act(p);reject(Error('Computation cancelled.'));assert.ok(!await flight);return {p,before};};
 let cancelled;await t.test('Cancel',async t=>{cancelled=left((await held(t,p=>p.cancel())).p);});
 await t.test('move',async t=>{const {p,before}=await held(t,p=>p.move(id,dir));
  assert.deepEqual(left(p),cancelled);assert.equal(status(p),line);assert.equal(said(p),line);assert.equal(cancelled.cancelRow,false);
  const order=[...before.pendingOrder],i=order.indexOf(id);[order[i],order[i+dir]]=[order[i+dir],order[i]];
  assert.equal(p.getState().pendingCase,before.pendingCase,'no other scenario is restored');assert.deepEqual(p.getState().pendingOrder,order);
  assert.equal(one(p,'.edit-status').textContent,`Selected: ${NAMES[before.pendingCase]}. ${pending??''}`);assert.equal(badge(p,'pending'),pending);
  assert.equal(p.getState().acceptedCase,before.acceptedCase);
 });
});
test('suspend keeps its pinned wording and clears an earlier reason',async t=>{
 const p=setup(t,{runStudy:failing('Computation timed out.')});await p.load();assert.ok(badge(p,'unavailable'));
 p.suspend();assert.equal(status(p),'Check interrupted. Compare to restart.');assert.equal(badge(p,'unavailable'),null);
});
test('badges are small-caps labels, not pills or buttons, at 4.5:1 or better; Unavailable has a non-colour cue',()=>{
 const css=readFileSync(new URL('../delivery-order/visual.css',import.meta.url),'utf8'),rule=s=>css.match(new RegExp(`(?:^|\\})${s.replace(/[.[\]]/g,'\\$&')}\\{([^}]*)\\}`))?.[1];
 const root=rule(':root'),hex=v=>v.startsWith('var(')?root.match(new RegExp(`${v.slice(4,-1)}:(#[0-9a-f]{6})`))[1]:v;
 const b=rule('.badge'),u=rule('[data-unavailable]');
 assert.match(b,/text-transform:uppercase/);assert.match(b,/letter-spacing:/);assert.doesNotMatch(b+u,/background|border-radius/);assert.match(u,/border-left:3px solid/);
 assert.match(rule('[data-unavailable] span'),/text-transform:none;letter-spacing:0/,'the reason is set in sentence case');
 const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
 const ratio=(a,c)=>{const [x,y]=[lum(a),lum(c)].sort((m,n)=>n-m);return (x+.05)/(y+.05);};
 // The decision panel and the page paper are the two surfaces the badges sit on.
 const panel=rule('.decision-panel').match(/background:(#[0-9a-f]{6})/)[1],paper=hex('var(--paper)');
 for(const ink of [b.match(/color:(#[0-9a-f]{6}|var\([^)]*\))/)[1],u.match(/color:(#[0-9a-f]{6}|var\([^)]*\))/)[1]].map(hex))for(const bg of [panel,paper])assert.ok(ratio(ink,bg)>=4.5,`badge ${ink} on ${bg}: ${ratio(ink,bg).toFixed(2)}`);
});
