// Product entry and navigation across three explicit teaching models.
import { el } from "./dom.js";
import { createHeroFilm } from "./hero-film.js";
import { createDepotScene } from "./depot-scene.js";
import { startFromPreset, CHOOSER_PRESET_IDS } from "./experiment.js";
import { openLearnCase } from "./learn.js";
import { createOperationsLab } from "./operations-lab.js";
import { createSimulationCatalog, simulationCatalog } from "./simulation-catalog.js";
import { createStreetLab } from "./street-lab.js";
import {defaultStreetConfig} from '../model/street-simulation.js';
import {ROUTES,routeHref,parseRoute,followLink} from './routes.js';
import {decodeSetup} from './setup-codec.js';
import {createSetupSharing} from './setup-sharing.js';
import {getRegionalSetup,loadRegionalSetup} from './regional-setup.js';

const action = (text, fn, primary = false) => el("button", { type:"button",class:primary?"studio-button studio-button-primary":"studio-button",on:{click:fn} },text);
const pageLink=(text,page,navigate,primary=false)=>el('a',{href:routeHref({page}),class:primary?'studio-button studio-button-primary':'studio-button',on:{click:event=>followLink(event,()=>navigate(page))}},text);
const eyebrow = (text) => el("p",{class:"eyebrow"},text);

function decisionCard({number,category,title,text,measure,cta,target},navigate) {
  return el("article",{class:"decision-card"},[
    el("div",{class:"card-top"},[eyebrow(category),el("span",{class:"card-number"},number)]),
    el("h3",{},title),el("p",{},text),el("p",{class:"card-measure"},[el("span",{},"WATCH"),measure]),
    pageLink(cta,target,navigate),
  ]);
}

function overview(navigate, film) {
  film.element.appendChild(el("span",{class:"film-illustration-label"},"Concept illustration · not simulation output"));
  return el("main",{class:"studio-overview",id:"studio-overview"},[
    el("section",{class:"studio-film-hero"},[
      film.element,
      el("div",{class:"film-scrim","aria-hidden":"true"}),
      el("div",{class:"film-copy"},[
        eyebrow("FLEET OPERATIONS, MADE EXPLORABLE"),
        el("h1",{},"Every great ride starts with a ready fleet."),
        el("p",{class:"film-lede"},"Explore the work between rides. Run a simulated fleet day, follow vehicles through the Bay Area, and see how demand, energy and depot capacity shape the day."),
        el("div",{class:"hero-actions"},[pageLink("Run a fleet day  →","simulation",navigate,true),pageLink("Explore the models  →","catalog",navigate)]),
        el("p",{class:"hero-duration"},"Start in three minutes · Runs in your browser"),
      ]),
    ]),
    el("div",{class:"film-caption"},[
      el("p",{},[el("strong",{},"Original 3D concept film"),"Waterfront travel, a neighborhood and a charging depot connect the ride to fleet readiness. An illustration, not a simulation result."]),
      el("p",{class:"creator-credit"},"Independent project by Bo-Huei Lin"),
    ]),
    el("section",{class:"depot-introduction"},[
      el("div",{class:"section-heading"},[el("div",{},[eyebrow("BETWEEN EVERY RIDE"),el("h2",{},"Readiness is a connected cycle.")]),el("p",{},"Explore the depot stages, then run the model to see how finite resources shape vehicle availability.")]),
      createDepotScene(),
    ]),
    el("section",{class:"studio-facts","aria-label":"Model scope"},[
      el("div",{},[el("strong",{},"18 Bay Area locations"),el("span",{},"Real geography, simulated operations")]),
      el("div",{},[el("strong",{},"Two vehicle profiles"),el("span",{},"Jaguar I-PACE and Ojai assumptions")]),
      el("div",{},[el("strong",{},"A connected operating cycle"),el("span",{},"Trips, energy and finite depot resources")]),
      el("div",{},[el("strong",{},"Repeatable experiments"),el("span",{},"Declared inputs and inspectable trade-offs")]),
    ]),
    el("section",{class:"decisions-section"},[
      el("div",{class:"section-heading"},[el("div",{},[eyebrow("WHY THIS EXISTS"),el("h2",{},"A local change can move the whole system.")]),el("p",{},"Explore the decisions behind rider service, vehicle readiness and limited capacity.")]),
      el("div",{class:"decision-grid"},[
        decisionCard({number:"01",category:"MARKET OPERATIONS",title:"Can supply keep up with the peak?",text:"Set fleet size and demand. Follow each AV through trips and depot work, then compare the capacity of different fleet and depot sizes.",measure:"Trips completed · Battery · Depot queues",cta:"Run a fleet day  →",target:"simulation"},navigate),
        decisionCard({number:"02",category:"DEPOT OPTIMIZATION",title:"Would two more bays actually help?",text:"Compare four cleaning bays with six. Inspect depot delay alongside rider outcomes before drawing a conclusion.",measure:"Bay wait · Depot turnaround · Guardrails",cta:"Test depot capacity  →",target:"depots"},navigate),
        decisionCard({number:"03",category:"STREET OPERATIONS",title:"Can one block tie up the fleet?",text:"Explore downtown SF, SFO and East Bay journeys on directed roads. Follow queues across blocks and compare routing decisions.",measure:"Spillback · Pickup wait · Empty distance",cta:"Open the Street lab  →",target:"streets"},navigate),
      ]),
    ]),
    el("section",{class:"loop-section","aria-label":"Three-minute demo"},[
      el("div",{class:"demo-heading"},[el("div",{},[eyebrow("HOW TO TRY IT"),el("h2",{},"Your first three minutes.")]),pageLink("Run a fleet day  →","simulation",navigate,true)]),
      el("ol",{class:"decision-loop"},[
        ["01 / RUN","Start with the default fleet.","Open Fleet day and run the default scenario. Watch trips and depot activity unfold across the Bay Area."],
        ["02 / INSPECT","Follow one vehicle.","Pick an AV. Inspect its trips, battery and depot work, then connect its day to the fleet outcomes."],
        ["03 / EXPLORE","Change one constraint.","Try a different fleet size or depot capacity and run again. Read completed trips alongside queues and energy."],
      ].map(([n,title,text])=>el("li",{},[el("span",{class:"loop-number"},n),el("h3",{},title),el("p",{},text)]))),
    ]),
    el("section",{class:"scope-section"},[
      el("div",{},[eyebrow("A CLEAR MODEL BOUNDARY"),el("h2",{},"Useful questions. Honest limits.")]),
      el("div",{},[el("h3",{},"Three ways to learn"),el("p",{},"Fleet day covers weather, energy and depot work. Street lab explores block-level queues and routing. Regional experiments cover dispatch, recall and paired guardrails. The catalog explains each model's scope.")]),
      el("div",{},[el("h3",{},"Outside the model"),el("p",{},"Worker shifts, physical driving, calibrated demand and real vehicle operations. Demand, traffic and vehicle operating values are teaching assumptions. None of these models is a calibrated digital twin or permission to change a fleet.")]),
    ]),
  ]);
}

function approach(navigate) {
  const rows = [
    ["Market lead","Locate a supply shortfall and understand the service impact.","Region availability, wait and unserved demand, with time and population in view."],
    ["Depot lead","Find the limiting resource before adding capacity.","Parking, cleaning and service queues; compare capacity and assignment rules."],
    ["Planning partner","Identify what must be true before expanding a depot.","Declared assumptions and a repeatable experiment; energy is simplified in Fleet day; a serial cleaning-worker extension is available; shifts and calibration remain future work."],
  ];
  return el("main",{class:"studio-approach",id:"studio-approach"},[
    el("section",{class:"approach-intro"},[eyebrow("PRODUCT APPROACH"),el("h1",{},"Start with the operator.\nWork back to the model."),el("p",{class:"hero-lede"},"A map shows where things are. A useful tool helps someone decide what to do next."),el("p",{},"FleetLab is the browser learning playground in Hermes, an independent simulation and evidence-review project. It connects the market and the depot through one operating cycle. It makes the consequences of a change inspectable, then uses repeated experiments to challenge the first impression.")]),
    el("section",{class:"approach-section"},[eyebrow("01 / PEOPLE & DECISIONS"),el("h2",{},"Different users. A shared operating picture."),el("div",{class:"people-grid"},rows.map(([role,job,tool])=>el("article",{},[el("h3",{},role),el("p",{class:"person-job"},job),el("p",{},tool)])))]),
    el("section",{class:"approach-case"},[
      el("div",{},[eyebrow("02 / A WORKED PRODUCT HYPOTHESIS"),el("h2",{},"More cleaning capacity should reduce depot delay."),el("p",{},"That hypothesis needs a second question: do rider outcomes improve, stay similar, or get worse? A local capacity change can move the constraint to another part of the system."),pageLink("Open the capacity experiment  →","depots",navigate,true)]),
      el("ol",{class:"hypothesis-steps"},[
        el("li",{},[el("strong",{},"Change one thing"),"Compare 4 and 6 cleaning bays at SF-1, using the existing capacity preset."]),
        el("li",{},[el("strong",{},"Declare the test first"),"Freeze the primary metric, equivalence margin, guardrails and paired seeds before the result. Seeds vary travel on one fixed demand trace."]),
        el("li",{},[el("strong",{},"Keep the trade-offs visible"),"Review uncertainty, missing measurements and guardrails. An attractive replay is not an experiment conclusion."]),
        el("li",{},[el("strong",{},"Choose the next test"),"A simulation recommendation is a screening result. It does not authorize an operational change."]),
      ]),
    ]),
    el("section",{class:"approach-section"},[
      eyebrow("03 / MODEL FIDELITY & ROADMAP"),el("h2",{},"The next fidelity is operational."),
      el("p",{class:"section-lede"},"This is not a calibrated digital twin. The next work should improve the decisions the model can support, with each extension tested separately."),
      el("div",{class:"roadmap"},[
        ["NOW","Test depot readiness","Serial staffing, two charging allocation treatments, delayed resource observations and synthetic airport preparation with paired guardrails."],
        ["NOW","Rehearse depot setup","Versioned region/site configuration, owned setup tasks, usable-resource checks and commissioning-delay rehearsals in Peninsula and fictional Region B."],
        ["NEXT","Increase model fidelity","Charge taper, worker shifts, service-time distributions and a broader operational validation set."],
        ["THEN","Calibrate & validate","Use approved operational data, fit travel and service distributions, check held-out periods and publish the error envelope."],
        ["LATER","Study physical questions","Choose a specific movement or mechanical question before adding a higher-fidelity simulator. These browser models have no physical actuation."],
      ].map(([phase,title,text])=>el("article",{},[eyebrow(phase),el("h3",{},title),el("p",{},text)]))),
    ]),
    el("section",{class:"approach-section"},[eyebrow("04 / HOW TO EVALUATE THE PRODUCT"),el("h2",{},"Test understanding, then usefulness."),el("div",{class:"people-grid"},[
      ["Comprehension","Can a first-time visitor explain the decision, name the constraint and distinguish one replay from repeated results?"],
      ["Decision quality","Can a reviewer find a regression or unavailable guardrail and choose a defensible next experiment?"],
      ["Workflow value","With operators, measure time to diagnosis, errors, task completion and whether the tool changes a planning decision."],
    ].map(([title,text])=>el("article",{},[el("h3",{},title),el("p",{},text)]))),el("p",{class:"study-note"},"These are proposed research questions. No operator study or adoption result is claimed.")]),
    el("section",{class:"approach-close"},[el("h2",{},"The model is a way to ask better questions."),pageLink("Take the guided walkthrough  →","tour",navigate,true)]),
  ]);
}

/** Coordinates presentation and validated setup handoffs; never computes simulation output. */
export function mountStudio(app) {
  const {root,store,playback,present}=app;
  const browserWindow=globalThis.window;
  const container=el('div',{class:'fleet-studio','data-page':'overview'});
  root.parentNode.insertBefore(container,root);
  const navItems=[['overview','Overview'],['simulation','Fleet day'],['streets','Street lab'],['depots','Experiments'],['catalog','Learning catalog'],['approach','Product approach']];
  const navLinks=navItems.map(([id,text])=>{
    const link=pageLink(text,id,navigate);link.setAttribute('data-nav',id);return link;
  });
  const brand=pageLink('F','overview',navigate);brand.setAttribute('class','studio-monogram');brand.setAttribute('aria-label','FleetLab overview');
  const skip=el('a',{href:'#studio-content',class:'studio-skip',on:{click:event=>{event.preventDefault();activeMain?.focus();}}},'Skip to main content');
  const header=el('header',{class:'studio-header'},[
    el('div',{class:'studio-brand'},[brand,el('div',{},[el('strong',{},'FleetLab'),el('span',{},'by Hermes')])]),
    el('nav',{'aria-label':'Main navigation'},navLinks),el('span',{class:'studio-status'},[el('span',{'aria-hidden':'true'},'◉'),'SIMULATION LAB']),
  ]);
  const boundary=el('div',{class:'studio-boundary',role:'note'},[el('strong',{},'Teaching model'),'Bay Area geography in Fleet day and Street lab; Region B is fictional. Simulated demand and operations. No real fleet performance claim.']);
  const film=createHeroFilm();
  const home=overview(navigate,film),product=approach(navigate);
  const operations=createOperationsLab({onCatalog:()=>navigate('catalog')});
  const streets=createStreetLab();
  const records=simulationCatalog();
  const lessonPage=record=>record.target==='operations'?'simulation':record.target==='streets'?'streets':CHOOSER_PRESET_IDS.includes(record.id)?'depots':'operations';
  const catalog=createSimulationCatalog({hrefForLesson:record=>routeHref({page:lessonPage(record),lesson:record.id}),onLesson:record=>visit({page:lessonPage(record),lesson:record.id})});
  const workspaceIntro=el('section',{class:'workspace-intro',tabindex:'-1'});
  const workspaceMain=el('main',{class:'studio-workspace'},[workspaceIntro,root]);
  const errorText=el('p',{});
  const routeError=el('main',{class:'studio-route-error',hidden:true},[eyebrow('LINK COULD NOT BE LOADED'),el('h1',{},'This setup needs attention.'),errorText,el('p',{},'No simulation was run. Check the complete link and the FleetLab version that created it, or choose a view from the navigation.'),el('button',{type:'button',class:'studio-button','data-action':'recover-route',on:{click:()=>navigate('overview')}},'Open the overview')]);
  const footer=el('footer',{class:'studio-footer'},[
    el('div',{},[el('strong',{},'FleetLab / Hermes'),el('p',{},'Designed and built by Bo-Huei Lin. Independent exploration of fleet operations and simulation-based decisions.')]),
    el('nav',{'aria-label':'Footer navigation'},[pageLink('Learning catalog','catalog',navigate),pageLink('Product approach','approach',navigate),pageLink('Guided walkthrough','tour',navigate)]),
    el('span',{},'Simulation for learning and exploration'),
  ]);
  let current='overview',initialized=false,capacityLoaded=false,activeMain=null,lastHandledHash=null,applying=false;
  const baseUrl=()=>browserWindow?.location?.href?.split('#')[0]??'';
  const shareLink=href=>{writeAddress(href,true);lastHandledHash=href;};
  const fleetShare=createSetupSharing({page:'simulation',models:[['fleet-day','Fleet day'],['launch-rehearsal','Launch rehearsal'],['regional-power','Austin regional power']],capture:(source,model)=>operations.getSharedSetup(source,model),onLink:shareLink,baseUrl});
  const streetShare=createSetupSharing({page:'streets',models:[['street-lab','Street lab']],capture:source=>streets.getSharedSetup(source),onLink:shareLink,baseUrl});
  const regionalShare=createSetupSharing({page:setup=>setup.config.mode==='experiment'?'depots':'operations',models:[['regional','Regional experiments']],capture:source=>getRegionalSetup(store.getState(),source),onLink:shareLink,baseUrl});
  operations.element.insertBefore(fleetShare.element,operations.element.children[1]??null);
  streets.element.insertBefore(streetShare.element,streets.element.children[1]??null);
  workspaceMain.insertBefore(regionalShare.element,root);
  for(const node of [skip,header,boundary,home,product,operations.element,streets.element,catalog.element,workspaceMain,routeError,footer])container.appendChild(node);
  if(app.regions?.rail&&app.regions?.map)root.insertBefore(app.regions.rail,app.regions.map);

  function writeAddress(href,replace=false){
    if(!browserWindow?.location)return;
    if(browserWindow.history?.pushState){browserWindow.history[replace?'replaceState':'pushState'](null,'',href);}
    else if(browserWindow.location.hash!==href)browserWindow.location.hash=href;
  }
  function navigate(page){visit({page});}
  function visit(route){const href=routeHref(route);writeAddress(href);applyRoute(href);}
  function pause(){playback.pause();operations.pause();streets.pause();}
  function focusMain(main,title){
    activeMain?.removeAttribute('id');activeMain=main;main.id='studio-content';main.setAttribute('tabindex','-1');document.title=`${title} · FleetLab by Hermes`;
    if(initialized){const heading=main.querySelector('h1');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});container.scrollIntoView?.({block:'start',behavior:'instant'});}
    initialized=true;
  }
  function renderPage(page){
    current=page;pause();
    if(store.getState().present.on&&page!=='tour')present.close();
    const workspace=['operations','depots','tour'].includes(page);
    root.hidden=!workspace;workspaceMain.hidden=!workspace;
    if(workspace)root.removeAttribute('inert');else root.setAttribute('inert','');
    home.hidden=page!=='overview';film.setActive(page==='overview');product.hidden=page!=='approach';
    operations.element.hidden=page!=='simulation';streets.element.hidden=page!=='streets';catalog.element.hidden=page!=='catalog';
    workspaceIntro.hidden=!workspace;regionalShare.element.hidden=page==='tour';routeError.hidden=true;
    boundary.hidden=workspace||page==='overview'||page==='approach';
    if(app.regions?.charts&&app.regions?.map&&app.regions?.inspector)root.insertBefore(app.regions.charts,page==='depots'?app.regions.map:app.regions.inspector);
    container.setAttribute('data-page',page);
    for(const link of navLinks){if(link.getAttribute('data-nav')===page)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
    if(page==='operations'){
      store.dispatch({type:'mode/set',mode:'sandbox'});
      workspaceIntro.replaceChildren(eyebrow('WORKSPACE / REGIONAL OPERATIONS'),el('h1',{},'Follow the fleet through a day.'),el('p',{},'Set up a scenario, run the simulated day, then inspect an area or depot. Read rider wait and unserved demand together. This is the older regional teaching model.'));
    }
    if(page==='depots'){
      if(!capacityLoaded){startFromPreset(store.dispatch,'UC-08a');capacityLoaded=true;}
      store.dispatch({type:'mode/set',mode:'experiment'});
      workspaceIntro.replaceChildren(eyebrow('WORKSPACE / DEPOT CAPACITY'),el('h1',{},'Test a depot capacity decision.'),el('p',{},'The first example compares four and six cleaning bays at SF-1. Your current setup and results are kept when you navigate away. Review the assumptions below, then freeze and run.'),action('Reset to the 4 vs 6 bay example',()=>{startFromPreset(store.dispatch,'UC-08a');store.dispatch({type:'mode/set',mode:'experiment'});}));
    }
    if(page==='tour'){
      workspaceIntro.replaceChildren(eyebrow('GUIDED WALKTHROUGH / ABOUT 6 MINUTES'),el('h1',{},'One day. Four ways to understand it.'),el('p',{},'Follow operations, analytics, simulation and product decisions. Prepare the example, then move through the chapters at your pace.'));
      if(!store.getState().present.on)present.open();
    }
    if(page==='streets')streets.refresh();
    focusMain(workspace?workspaceMain:page==='approach'?product:page==='simulation'?operations.element:page==='streets'?streets.element:page==='catalog'?catalog.element:home,ROUTES[page].title);
  }
  function applyLesson(record){
    if(record.target==='operations'){
      const patch=typeof record.patch==='function'?record.patch():structuredClone(record.patch);
      if(patch.launch_rehearsal){operations.chooseLaunchTemplate(patch.launch_rehearsal);fleetShare.setModel('launch-rehearsal');}
      else{operations.loadScenario(patch);fleetShare.setModel('fleet-day');}
    }else if(record.target==='streets')streets.loadSharedSetup({model:'street-lab',config:{...defaultStreetConfig(),hotspot:record.hotspot},options:{}});
    else{
      app.host?.cancel();
      const preset=record.preset;
      if(CHOOSER_PRESET_IDS.includes(preset.id))startFromPreset(store.dispatch,preset.id);
      else if(preset.learnCase){openLearnCase(store.dispatch,preset.learnCase);store.dispatch({type:'mode/set',mode:'learn'});}
      else store.dispatch({type:'preset/select',presetId:preset.id,scenario:preset.scenario});
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
      renderPage(route.page);
      if(record)applyLesson(record);
      if(setup){
        if(setup.model==='street-lab')streets.loadSharedSetup(setup);
        else if(setup.model==='regional'){app.host?.cancel();loadRegionalSetup(store,setup);}
        else{operations.loadSharedSetup(setup);fleetShare.setModel(setup.model);}
        pause();
      }
      if(record)document.title=`${record.title} · FleetLab by Hermes`;
      for(const share of [fleetShare,streetShare,regionalShare])share.clear();
      if(setup)(setup.model==='street-lab'?streetShare:setup.model==='regional'?regionalShare:fleetShare).loaded();
    }catch(error){
      pause();current='error';if(store.getState().present.on)present.close();
      for(const node of [home,product,operations.element,streets.element,catalog.element,workspaceMain,root,boundary])node.hidden=true;
      film.setActive(false);root.setAttribute('inert','');routeError.hidden=false;errorText.textContent=error.message;container.setAttribute('data-page','error');
      for(const link of navLinks)link.removeAttribute('aria-current');
      focusMain(routeError,'Link could not be loaded');
    }finally{applying=false;}
  }
  const addressChanged=()=>{const hash=browserWindow?.location?.hash??'';if(hash!==lastHandledHash)applyRoute(hash);};
  browserWindow?.addEventListener('hashchange',addressChanged);
  applyRoute(browserWindow?.location?.hash??'');
  let previousPresent=store.getState().present.on;
  const unsubscribe=store.subscribe(state=>{const was=previousPresent;previousPresent=state.present.on;if(was&&!state.present.on&&current==='tour'&&!applying)navigate('operations');});
  return {navigate,applyRoute,operations,streets,element:container,destroy(){browserWindow?.removeEventListener('hashchange',addressChanged);film.destroy();operations.destroy();streets.destroy();unsubscribe();root.hidden=false;root.removeAttribute('inert');container.parentNode?.insertBefore(root,container);container.remove();}};
}
