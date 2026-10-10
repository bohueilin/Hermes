import {LESSON_FRAMES,SURFACE_FRAMES,frameView,glossaryView} from './teaching-frames.js';
import {modelHeader,NON_AFFILIATION} from './model-identity.js';
import {isReducedMotion} from './store.js';
import {MODEL_VERSION} from '../model/experiment.js';
import {presetById} from '../model/presets.js';
// Product entry and navigation across explicit teaching models.
import { el } from "./dom.js";
import { createHeroFilm } from "./hero-film.js";
import { createDepotScene } from "./depot-scene.js";
import { startFromPreset, CHOOSER_PRESET_IDS } from "./experiment.js";
import { openLearnCase } from "./learn.js";
import { createOperationsLab } from "./operations-lab.js";
import { createSimulationCatalog, simulationCatalog } from "./simulation-catalog.js";
import { createStreetLab } from "./street-lab.js";
import {createScaleLab} from './scale-lab.js';
import {createDepotFlowLab} from './depot-flow-lab.js';
import {defaultStreetConfig} from '../model/street-simulation.js';
import {ROUTES,routeHref,parseRoute,followLink} from './routes.js';
import {decodeSetup} from './setup-codec.js';
import {createSetupSharing} from './setup-sharing.js';
import {getRegionalSetup,loadRegionalSetup} from './regional-setup.js';

const action = (text, fn, primary = false) => el("button", { type:"button",class:primary?"studio-button studio-button-primary":"studio-button",on:{click:fn} },text);
const pageLink=(text,page,navigate,primary=false)=>el('a',{href:routeHref({page}),class:primary?'studio-button studio-button-primary':'studio-button',on:{click:event=>followLink(event,()=>navigate(page))}},text);
const eyebrow = (text) => el("p",{class:"eyebrow"},text);

function overview(navigate, visit, film) {
  film.element.appendChild(el("span",{class:"film-illustration-label"},"Concept illustration · not simulation output"));
  const first={page:"flows",lesson:"two-vehicles"};
  return el("main",{class:"studio-overview",id:"studio-overview"},[
    el("section",{class:"studio-film-hero"},[
      el("div",{class:"film-copy"},[
        eyebrow("INTERACTIVE FLEET SIMULATIONS"),
        el("h1",{},"See what keeps a fleet moving."),
        el("p",{class:"film-lede"},"Try small simulations of trips, charging and depot work. Change one decision, follow what happens, and see the trade-offs."),
        el("div",{class:"hero-actions"},[el("a",{href:routeHref(first),class:"studio-button studio-button-primary",on:{click:event=>followLink(event,()=>visit(first))}},"Try a 3-minute experiment  →"),pageLink("Explore all lessons","catalog",navigate)]),
        el("p",{class:"hero-duration"},"About three minutes · No account needed · Nothing runs until you press Run"),
        el("div",{class:"welcome-boundary"},[el("strong",{},"Synthetic teaching simulator"),el("span",{},"NOT_EVIDENCE · simulation only · decision authority NONE")]),
      ]),
      el("section",{class:"start-points","aria-labelledby":"start-points-title"},[
        el("h2",{id:"start-points-title"},"Choose another starting point."),
        el("div",{class:"start-grid"},[
          {label:"FLEET DAY · RUN A MODEL",title:"Can the fleet meet demand?",text:"Run a synthetic Bay Area day. Change the fleet or a depot, then read service, batteries and queues together.",cta:"Run a fleet day  →",page:"simulation"},
          {label:"STREET LAB · RUN A MODEL",title:"Where do queues form?",text:"Directed San Francisco streets with block queues. Compare two route rules on the same riders.",cta:"Open the Street lab  →",page:"streets"},
        ].map(({label,title,text,cta,page})=>el("article",{class:"start-card"},[eyebrow(label),el("h3",{},title),el("p",{},text),pageLink(cta,page,navigate)]))),
      ]),
      el("div",{class:"welcome-visual"},[
        el("div",{class:"welcome-visual-heading"},[el("span",{},"THE WORK BETWEEN RIDES"),el("span",{"aria-hidden":"true"},"↗")]),
        film.element,
        el("div",{class:"welcome-cycle","aria-label":"Illustrated fleet cycle"},["Ride","Recharge","Reset","Repeat"].map((word,i)=>el("span",{},[el("small",{},`0${i+1}`),word]))),
      ]),
      el("div",{class:"film-caption"},[
        el("p",{},[el("strong",{},"Original 3D concept film"),"Waterfront travel, a neighborhood and a charging depot connect the ride to fleet readiness. An illustration, not a simulation result."]),
        el("p",{class:"creator-credit"},"Independent exploration. Built with curiosity."),
      ]),
    ]),
    el("nav",{class:"home-browse","aria-label":"Browse"},[pageLink("Browse all topics  →","catalog",navigate),pageLink("About & limits  →","approach",navigate)]),
  ]);
}

function approach(navigate) {
  const rows = [
    ["Market lead","Locate a supply shortfall and understand the service impact.","Region availability, wait and unserved demand, with time and population in view."],
    ["Depot lead","Find the limiting resource before adding capacity.","Parking, cleaning and service queues; compare capacity and assignment rules."],
    ["Planning partner","Identify what must be true before expanding a depot.","Declared assumptions and a repeatable experiment; energy is simplified in Fleet day; a serial cleaning-worker extension is available; shifts and calibration remain future work."],
  ];
  return el("main",{class:"studio-approach",id:"studio-approach"},[
    el("section",{class:"approach-intro"},[eyebrow("ABOUT & LIMITS"),el("h1",{},"What FleetLab models, and what it does not."),el("p",{class:"hero-lede"},"FleetLab is the browser learning playground inside Hermes, an independent simulation and evidence-review project. Every model here is synthetic, inspectable and bounded."),el("p",{},NON_AFFILIATION)]),
    el("section",{class:"approach-section"},[
      eyebrow("01 / WHAT FLEETLAB MODELS"),el("h2",{},"Five labs, each with its own model and limits."),
      el("div",{class:"approach-scope"},[
        el("div",{},[el("h3",{},"Find the right learning model"),el("p",{},"Fleet day covers weather, energy and depot work. Street lab explores block-level queues and routing. Four-area experiments cover dispatch, recall and paired guardrails. Scale lab covers density at rungs, fleet intake and a support pool. Depot flow lab explains how uploads and charging combine to determine readiness. Explore lists each model's lessons and scope.")]),
        el("div",{},[el("h3",{},"Outside the model"),el("p",{},"Worker shifts, physical driving, calibrated demand and real vehicle operations. Demand, traffic and vehicle operating values are teaching assumptions. None of these models is a calibrated digital twin or permission to change a fleet.")]),
      ]),
      createDepotScene(),
    ]),
    el("section",{class:"approach-section"},[eyebrow("02 / PEOPLE & DECISIONS"),el("h2",{},"Different users. A shared operating picture."),el("div",{class:"people-grid"},rows.map(([role,job,tool])=>el("article",{},[el("h3",{},role),el("p",{class:"person-job"},job),el("p",{},tool)])))]),
    el("section",{class:"approach-case"},[
      el("div",{},[eyebrow("03 / HOW RESULTS ARE PRODUCED AND CHECKED"),el("h2",{},"Run computes. Checks reconstruct. Nothing here is authority."),el("p",{},"A worked example: more cleaning capacity should reduce depot delay. The second question is whether rider outcomes improve, stay similar, or get worse, because a local capacity change can move the constraint to another part of the system."),pageLink("Open the capacity experiment  →","depots",navigate)]),
      el("ol",{class:"hypothesis-steps"},[
        el("li",{},[el("strong",{},"Change one thing"),"Compare 4 and 6 cleaning bays at SF-1, using the existing capacity preset."]),
        el("li",{},[el("strong",{},"Declare the test first"),"Freeze the primary metric, equivalence margin, guardrails and paired seeds before the result. Seeds vary travel on one fixed demand trace."]),
        el("li",{},[el("strong",{},"Keep the trade-offs visible"),"Review uncertainty, missing measurements and guardrails. An attractive replay is not an experiment conclusion."]),
        el("li",{},[el("strong",{},"Choose the next test"),"A simulation recommendation is a screening result. It does not authorize an operational change."]),
        el("li",{},[el("strong",{},"Keep the record"),"Every lesson keeps its inputs, outcomes and named checks inspectable; NOT_EVIDENCE means a teaching run, not a qualified result."]),
      ]),
    ]),
    el("section",{class:"approach-section"},[
      eyebrow("04 / ROADMAP"),el("h2",{},"The next fidelity is operational."),
      el("p",{class:"section-lede"},"This is not a calibrated digital twin. The next work should improve the decisions the model can support, with each extension tested separately."),
      el("div",{class:"roadmap"},[
        ["NOW","Test depot readiness","Serial staffing, two charging allocation treatments, delayed resource observations and synthetic airport preparation with paired guardrails."],
        ["NOW","Rehearse depot setup","Versioned region/site configuration, owned setup tasks, usable-resource checks and commissioning-delay rehearsals in Peninsula and fictional Region B."],
        ["PLANNED","Depot flow lab, next lessons","Capacity decisions, competing data jobs, estimate error and custody are planned lessons, not available ones."],
        ["NEXT","Increase model fidelity","Charge taper, worker shifts, service-time distributions and a broader operational validation set."],
        ["THEN","Calibrate & validate","Use approved operational data, fit travel and service distributions, check held-out periods and publish the error envelope."],
        ["LATER","Study physical questions","Choose a specific movement or mechanical question before adding a higher-fidelity simulator. These browser models have no physical actuation."],
      ].map(([phase,title,text])=>el("article",{},[eyebrow(phase),el("h3",{},title),el("p",{},text)]))),
    ]),
    el("section",{class:"approach-section"},[eyebrow("05 / HOW TO EVALUATE"),el("h2",{},"Test understanding, then usefulness."),el("div",{class:"people-grid"},[
      ["Comprehension","Can a first-time visitor explain the decision, name the constraint and distinguish one replay from repeated results?"],
      ["Decision quality","Can a reviewer find a regression or unavailable guardrail and choose a defensible next experiment?"],
      ["Workflow value","With operators, measure time to diagnosis, errors, task completion and whether the tool changes a planning decision."],
    ].map(([title,text])=>el("article",{},[el("h3",{},title),el("p",{},text)]))),el("p",{class:"study-note"},"These are proposed research questions. No operator study or adoption result is claimed.")]),
    el("section",{class:"approach-section"},[eyebrow("06 / READING ACROSS MODELS"),el("h2",{},"Read each model on its own terms."),
      el("p",{},"Fleet day also hosts separate contracts: staffing, charging, charger status, airport wave, launch rehearsal and the Austin power lab."),
      el("p",{},"Each model has its own assumptions, so numbers from different models are not interchangeable."),
    ]),
    el("section",{class:"approach-close"},[el("h2",{},"The model is a way to ask better questions."),pageLink("Take the guided walkthrough  →","tour",navigate,true)]),
  ]);
}

/** Coordinates presentation and validated setup handoffs; never computes simulation output. */
export function mountStudio(app) {
  const {root,store,playback,present}=app;
  const browserWindow=globalThis.window;
  const container=el('div',{class:'fleet-studio','data-page':'overview'});
  root.parentNode.insertBefore(container,root);
  const navLink=([id,text])=>{const link=pageLink(text,id,navigate);link.setAttribute('data-nav',id);return link;};
  const navItems=[['overview','Home'],['catalog','Explore'],['approach','About & limits']];
  const navLinks=navItems.map(navLink);
  const labLinkNodes=[['simulation','Fleet day'],['streets','Street lab'],['depots','Four-area experiments'],['scale','Scale lab'],['flows','Depot flow lab'],['tour','Guided walkthrough']].map(navLink);
  const labLinks=el('nav',{class:'lab-links','aria-label':'Labs'},labLinkNodes);
  const brand=pageLink('F','overview',navigate);brand.setAttribute('class','studio-monogram');brand.setAttribute('aria-label','FleetLab home');
  const skip=el('a',{href:'#studio-content',class:'studio-skip',on:{click:event=>{event.preventDefault();activeMain?.focus();}}},'Skip to main content');
  const navigation=el('nav',{id:'studio-navigation','aria-label':'Main navigation','data-expanded':'false'},navLinks);
  const menu=el('button',{type:'button',class:'studio-menu','aria-controls':'studio-navigation','aria-expanded':'false',on:{click:()=>setMenu(menu.getAttribute('aria-expanded')!=='true')}},'Menu');
  function setMenu(open){menu.setAttribute('aria-expanded',String(open));navigation.setAttribute('data-expanded',String(open));menu.textContent=open?'Close':'Menu';}
  const header=el('header',{class:'studio-header'},[
    el('div',{class:'studio-brand'},[brand,el('div',{},[el('strong',{},'FleetLab'),el('span',{},'by Hermes')])]),
    menu,navigation,
  ]);
  const reducedMotion=()=>isReducedMotion(store.getState());
  const film=createHeroFilm({reducedMotion});
  const home=overview(navigate,visit,film),product=approach(navigate);
  const operations=createOperationsLab({reducedMotion,onCatalog:()=>navigate('catalog')});
  const streets=createStreetLab({reducedMotion});
  const flows=createDepotFlowLab({reducedMotion});
  const scale=createScaleLab({onLab:id=>visit({page:'scale',lesson:id})});
  operations.element.querySelector('.ops-intro').appendChild(el('p',{class:'ops-status'},['Fleet day stops at 120 cars. For what changes as a fleet scales, ',el('a',{href:routeHref({page:'scale'}),on:{click:event=>followLink(event,()=>navigate('scale'))}},'open the Scale lab'),'.']));
  const records=simulationCatalog();
  const lessonPage=record=>record.target==='flows'?'flows':record.target==='scale'?'scale':record.target==='operations'?'simulation':record.target==='streets'?'streets':CHOOSER_PRESET_IDS.includes(record.id)?'depots':'operations';
  const catalog=createSimulationCatalog({labLinks,hrefForLesson:record=>routeHref({page:lessonPage(record),lesson:record.id}),onLesson:record=>visit({page:lessonPage(record),lesson:record.id})});
  const workspaceIntro=el('section',{class:'workspace-intro',tabindex:'-1'});
  const workspaceIdentity=modelHeader('Four-area experiments','Schematic four-area Bay Area zones (San Francisco, Peninsula, San Jose, East Bay); not road geometry',MODEL_VERSION);
  const workspaceMain=el('main',{class:'studio-workspace'},[workspaceIntro,root]);
  const errorText=el('p',{});
  const routeError=el('main',{class:'studio-route-error',hidden:true},[eyebrow('LINK COULD NOT BE LOADED'),el('h1',{},'This setup needs attention.'),errorText,el('p',{},'No simulation was run. Check the complete link and the FleetLab version that created it, or choose a view from the navigation.'),el('button',{type:'button',class:'studio-button','data-action':'recover-route',on:{click:()=>navigate('overview')}},'Go to Home')]);
  const footer=el('footer',{class:'studio-footer'},[
    el('p',{},'An independent educational project by Bo-Huei Lin. Not affiliated with or endorsed by Waymo, Zoox, or their partners.'),
    el('div',{},[el('strong',{},'FleetLab / Hermes'),el('p',{},'FleetLab is part of Hermes, an independent simulation and evidence-review project. Built with AI assistance. Synthetic models, inspectable assumptions.')]),
    el('nav',{'aria-label':'Footer navigation'},[pageLink('Explore','catalog',navigate),pageLink('About & limits','approach',navigate),pageLink('Guided walkthrough','tour',navigate)]),
    el('span',{},'Simulation for learning and exploration'),
  ]);
  let workspaceLesson=null,lessonSetup=null;
  const setupKey=state=>JSON.stringify([state.scenario,state.experiment.draft]);
  function renderLesson(state){workspaceIntro.replaceChildren(frameView(LESSON_FRAMES[workspaceLesson.id],{title:workspaceLesson.title,heading:'h1',seeds:state.experiment.draft?.seedCount,edited:setupKey(state)!==lessonSetup}),el('details',{},[el('summary',{},'Exact values'),workspaceIdentity.element]),glossaryView());}
  let current='overview',initialized=false,capacityLoaded=false,activeMain=null,lastHandledHash=null,applying=false;
  const baseUrl=()=>browserWindow?.location?.href?.split('#')[0]??'';
  const shareLink=href=>{writeAddress(href,true);lastHandledHash=href;};
  const fleetShare=createSetupSharing({page:'simulation',models:[['fleet-day','Fleet day']],capture:(source,model)=>operations.getSharedSetup(source,model),onLink:shareLink,baseUrl});
  const launchShare=createSetupSharing({page:'simulation',models:[['launch-rehearsal','Launch rehearsal']],capture:source=>operations.getSharedSetup(source,'launch-rehearsal'),onLink:shareLink,baseUrl});
  const austinShare=createSetupSharing({page:'simulation',models:[['regional-power','Austin power and readiness']],capture:source=>operations.getSharedSetup(source,'regional-power'),onLink:shareLink,baseUrl});
  const streetShare=createSetupSharing({page:'streets',models:[['street-lab','Street lab']],capture:source=>streets.getSharedSetup(source),onLink:shareLink,baseUrl});
  const regionalShare=createSetupSharing({page:setup=>setup.config.mode==='experiment'?'depots':'operations',models:[['regional','Four-area experiments']],capture:source=>getRegionalSetup(store.getState(),source),onLink:shareLink,baseUrl});
  operations.shareSlot.appendChild(fleetShare.element);operations.launchPanel.shareSlot.appendChild(launchShare.element);operations.regionalPanel.shareSlot.appendChild(austinShare.element);
  streets.element.insertBefore(streetShare.element,streets.element.children[1]??null);
  workspaceMain.insertBefore(regionalShare.element,root);
  for(const node of [skip,header,home,product,operations.element,streets.element,scale.element,flows.element,catalog.element,workspaceMain,routeError,footer])container.appendChild(node);
  if(app.regions?.rail&&app.regions?.map)root.insertBefore(app.regions.rail,app.regions.map);

  function writeAddress(href,replace=false){
    if(!browserWindow?.location)return;
    if(browserWindow.history?.pushState){browserWindow.history[replace?'replaceState':'pushState'](null,'',href);}
    else if(browserWindow.location.hash!==href)browserWindow.location.hash=href;
  }
  function navigate(page){visit({page});}
  function visit(route){const href=routeHref(route);writeAddress(href);applyRoute(href);}
  function pause(){playback.pause();operations.pause();streets.pause();scale.pause();flows.pause();}
  function focusMain(main,title){
    activeMain?.removeAttribute('id');activeMain=main;main.id='studio-content';main.setAttribute('tabindex','-1');document.title=`${title} · FleetLab by Hermes`;
    if(initialized){const heading=main.querySelector('h1');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});container.scrollIntoView?.({block:'start',behavior:'instant'});}
    initialized=true;
  }
  function renderPage(page){
    setMenu(false);
    workspaceLesson=null;current=page;pause();
    if(store.getState().present.on&&page!=='tour')present.close();
    const workspace=['operations','depots','tour'].includes(page);
    root.hidden=!workspace;workspaceMain.hidden=!workspace;
    if(workspace)root.removeAttribute('inert');else root.setAttribute('inert','');
    home.hidden=page!=='overview';film.setActive(page==='overview');product.hidden=page!=='approach';
    operations.element.hidden=page!=='simulation';streets.element.hidden=page!=='streets';scale.element.hidden=page!=='scale';flows.element.hidden=page!=='flows';catalog.element.hidden=page!=='catalog';
    workspaceIntro.hidden=!workspace;regionalShare.element.hidden=page==='tour';routeError.hidden=true;
    if(app.regions?.charts&&app.regions?.map&&app.regions?.inspector)root.insertBefore(app.regions.charts,page==='depots'?app.regions.map:app.regions.inspector);
    container.setAttribute('data-page',page);
    for(const link of [...navLinks,...labLinkNodes]){if(link.getAttribute('data-nav')===page)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
    if(page==='operations'){
      store.dispatch({type:'mode/set',mode:'sandbox'});
      workspaceIntro.replaceChildren(eyebrow('WORKSPACE / REGIONAL OPERATIONS'),el('h1',{},'Follow the fleet through a day.'),el('p',{},'Set up a scenario, run the simulated day, then inspect an area or depot. Read rider wait and unserved demand together. This is the four-area teaching model.'));
    }
    if(page==='depots'){
      if(!capacityLoaded){startFromPreset(store.dispatch,'UC-08a');capacityLoaded=true;}
      store.dispatch({type:'mode/set',mode:'experiment'});
      workspaceIntro.replaceChildren(eyebrow('WORKSPACE / DEPOT CAPACITY'),el('h1',{},'Test a depot capacity decision.'),el('p',{},'The first example compares four and six cleaning bays at SF-1. Your current setup and results are kept when you navigate away. Review the assumptions below, then freeze and run.'),action('Reset to the 4 vs 6 bay example',()=>{startFromPreset(store.dispatch,'UC-08a');store.dispatch({type:'mode/set',mode:'experiment'});}));
    }
    if(page==='tour'){
      const s=store.getState(),shown=s.run.log!==null&&s.run.worldAtQueue!==null?s.run.worldAtQueue.presetId:s.presetId;
      workspaceIntro.replaceChildren(eyebrow('GUIDED WALKTHROUGH / ABOUT 6 MINUTES'),el('h1',{},'One question, one day, one verdict.'),el('p',{},'OPS-01 asks whether 52 San Francisco cars instead of 40 change evening rider wait. Watch the day, read the verdict, then see what it trades and what to test next.'),...(s.present.prepared||shown==='OPS-01'?[]:[el('p',{},`This walkthrough prepares OPS-01 when you press Prepare. Until then the map shows ${presetById(shown)?.title??shown}.`)]));
      if(!store.getState().present.on)present.open();
    }
    if(workspace){workspaceIntro.appendChild(el('details',{},[el('summary',{},'Exact values'),workspaceIdentity.element]));updateWorkspaceIdentity(store.getState());}
    if(['operations','depots'].includes(page)){const frame=SURFACE_FRAMES[page==='operations'?'four-area':'workbench'];const h=workspaceIntro.querySelector('h1');h.textContent=page==='operations'?'Explore a day':'Four-area experiments';workspaceIntro.replaceChildren(frameView(frame,{title:h.textContent,heading:'h1',seeds:store.getState().experiment.draft?.seedCount}),el('details',{},[el('summary',{},'Exact values'),workspaceIdentity.element]));}
    if(page==='streets')streets.refresh();
    focusMain(workspace?workspaceMain:page==='approach'?product:page==='simulation'?operations.element:page==='streets'?streets.element:page==='scale'?scale.element:page==='flows'?flows.element:page==='catalog'?catalog.element:home,ROUTES[page].title);
  }
  function applyLesson(record){
    if(record.target==='flows')flows.setLesson(record);
    else if(record.target==='scale')scale.setLesson(record);
    else if(record.target==='operations'){
      const patch=typeof record.patch==='function'?record.patch():structuredClone(record.patch);
      if(patch.launch_rehearsal){operations.setLesson(null);operations.chooseLaunchTemplate(patch.launch_rehearsal);operations.launchPanel.setLesson(record);}
      else{operations.loadScenario(patch);operations.setLesson(record);}
    }else if(record.target==='streets'){streets.loadSharedSetup({model:'street-lab',config:{...defaultStreetConfig(),hotspot:record.hotspot},options:{}});streets.setLesson(record);}
    else{
      app.host?.cancel();
      const preset=record.preset;
      if(CHOOSER_PRESET_IDS.includes(preset.id))startFromPreset(store.dispatch,preset.id);
      else if(preset.learnCase){openLearnCase(store.dispatch,preset.learnCase);store.dispatch({type:'mode/set',mode:'learn'});}
      else store.dispatch({type:'preset/select',presetId:preset.id,scenario:preset.scenario});
      workspaceLesson=record;lessonSetup=setupKey(store.getState());renderLesson(store.getState());
    }

    pause();
  }
  function applyRoute(hash){
    applying=true;lastHandledHash=hash;
    try{
      const route=parseRoute(hash);
      const record=route.lesson?records.find(r=>r.id===route.lesson):null;
      if(route.lesson&&(!record||lessonPage(record)!==route.page))throw Error('This lesson does not belong to the linked view.');
      const setup=route.setup?decodeSetup(route.setup):null;
      if(setup){
        const expected=setup.model==='street-lab'?'streets':setup.model==='regional'?(setup.config.mode==='experiment'?'depots':'operations'):'simulation';
        if(route.page!==expected)throw Error('The linked view and shared model do not match.');
      }
      if(record?.target==='flows')applyLesson(record);
      renderPage(route.page);
      if(record&&record.target!=='flows')applyLesson(record);
      if(setup){
        if(setup.model==='street-lab')streets.loadSharedSetup(setup);
        else if(setup.model==='regional'){app.host?.cancel();loadRegionalSetup(store,setup);}
        else operations.loadSharedSetup(setup);
        pause();
      }
      if(record?.id==='region-launch'){const h=operations.launchPanel.heading;h.focus();h.scrollIntoView?.({block:'start'});}
      if(record)document.title=`${record.title} · FleetLab by Hermes`;
      for(const share of [fleetShare,launchShare,austinShare,streetShare,regionalShare])share.clear();
      if(setup){const shared={'fleet-day':fleetShare,'launch-rehearsal':launchShare,'regional-power':austinShare,'street-lab':streetShare,regional:regionalShare};shared[setup.model].loaded();const target=setup.model==='launch-rehearsal'?operations.launchPanel.heading:setup.model==='regional-power'?operations.regionalPanel.heading:setup.model==='fleet-day'?operations.summaryHeading:setup.model==='street-lab'?streets.element.querySelector('h1'):workspaceIntro.querySelector('h1');target.setAttribute('tabindex','-1');target.focus();}
    }catch(error){
      pause();current='error';if(store.getState().present.on)present.close();
      for(const node of [home,product,operations.element,streets.element,scale.element,flows.element,catalog.element,workspaceMain,root])node.hidden=true;
      film.setActive(false);root.setAttribute('inert','');routeError.hidden=false;errorText.textContent=typeof error.message==='string'&&error.message.length<=160?error.message:'This link has an invalid setup. Check its format and model version.';container.setAttribute('data-page','error');
      for(const link of [...navLinks,...labLinkNodes])link.removeAttribute('aria-current');
      focusMain(routeError,'Link could not be loaded');
    }finally{applying=false;}
  }
  const addressChanged=()=>{const hash=browserWindow?.location?.hash??'';if(hash!==lastHandledHash)applyRoute(hash);};
  browserWindow?.addEventListener('hashchange',addressChanged);
  applyRoute(browserWindow?.location?.hash??'');
  function updateWorkspaceIdentity(state){workspaceIdentity.update(state.experiment.frozen?.spec.model_version??MODEL_VERSION,state.experiment.verdictStale||state.run.stale);}
  let previousMotion=reducedMotion();
  let previousPresent=store.getState().present.on;
  const unsubscribe=store.subscribe(state=>{if(workspaceLesson&&!applying)renderLesson(state);updateWorkspaceIdentity(state);const motion=reducedMotion();if(motion!==previousMotion){previousMotion=motion;flows.motionChanged();film.setActive(current==='overview');}const was=previousPresent;previousPresent=state.present.on;if(was&&!state.present.on&&current==='tour'&&!applying)navigate('operations');});
  return {navigate,applyRoute,operations,streets,scale,flows,element:container,destroy(){browserWindow?.removeEventListener('hashchange',addressChanged);film.destroy();operations.destroy();streets.destroy();scale.destroy();flows.destroy();unsubscribe();root.hidden=false;root.removeAttribute('inert');container.parentNode?.insertBefore(root,container);container.remove();}};
}
