import {el} from './dom.js';
export function networkChrome(root){
 const nav=root.querySelector('header nav'),linkClass=nav.querySelector('a')?.className||'';
 nav.setAttribute('aria-label','Main navigation');
 nav.replaceChildren(...[['Home','/#/overview'],['Explore','/#/catalog'],['About & limits','/#/approach']].map(([t,href])=>el('a',{href,class:linkClass},t)));
 const main=root.querySelector('main');
 if(!root.querySelector('#network-vocabulary')){const glossary=el('section',{id:'network-vocabulary',class:'glossary'},[
  el('h2',{},'Fleet states, in plain language'),el('dl',{},[
   el('dt',{id:'glossary-ready'},'Ready / idle'),el('dd',{},'Available for dispatch and not executing a move.'),
   el('dt',{id:'glossary-cod'},'COD: Car on Drive'),el('dd',{},'Executing a pickup, passenger trip or empty repositioning move.'),
   el('dt',{id:'glossary-vor'},'VOR: Vehicle Off-Road'),el('dd',{},'Unavailable for dispatch: off the drive network, not off the pavement. Charging, updating and maintenance are examples.')]),
  el('p',{},'These are FleetLab teaching labels, not universal AV-industry terminology. Each lesson defines which activities it models; idle is not COD or VOR.')
 ]);const f=main.querySelector('footer');main.insertBefore(glossary,f?.parentNode===main?f:null);}
 let footer=root.querySelector('footer');if(!footer){footer=el('footer',{});root.appendChild(footer);}
 if(!footer.querySelector('.network-trust'))footer.appendChild(el('p',{class:'network-trust'},'An independent learning project by Bo-Huei Lin. Synthetic models, inspectable assumptions. Not affiliated with or endorsed by an AV operator.'));
}
