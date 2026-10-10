// Hosted FleetLab entry points. The standalone teaching/offline build is unchanged.
// No City renderer, recordings or map data load until the visitor follows a link.
export function mountCityEntry(doc = document) {
  if (doc.getElementById('city-explorer-entry')) return;
  const labLinks = doc.querySelector('.lab-links');
  const home = doc.querySelector('.studio-overview');
  const startGrid = home?.querySelector('.start-grid');
  const catalogGrid = doc.querySelector('.simulation-catalog .catalog-grid');
  const networkQuestions = doc.querySelector('.network-question-list');
  const flowHero = doc.querySelector('.depot-flow-lab .flow-hero');
  if (!labLinks || !startGrid || !catalogGrid || !networkQuestions || !flowHero?.querySelector('p.flow-run-help')) throw new Error('FleetLab hosted entry contract changed');
  const node = (tag, attrs, children) => {
    const element = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) element.setAttribute(key, value);
    for (const child of [children].flat().filter(value => value != null)) {
      element.appendChild(typeof child === 'string' ? doc.createTextNode(child) : child);
    }
    return element;
  };
  labLinks.appendChild(node('a', {id:'city-explorer-entry', class:'studio-button', href:'/city-explorer/'}, 'City Explorer'));
  labLinks.appendChild(node('a', {id:'capacity-lab-entry', class:'studio-button', href:'/network-flows/capacity/'}, 'Scheduling or capacity?'));
  // Replace the offline entry, including its hash-navigation handler, with a native hosted link.
  const heroAction = home.querySelector('.hero-actions .studio-button-primary');
  heroAction.parentNode.insertBefore(node('a', {class:'studio-button studio-button-primary',href:'/network-flows/capacity/'}, 'Explore depot operations  →'),heroAction);
  heroAction.remove();
  home.querySelector('.hero-actions').appendChild(node('a', {class:'home-city-link',href:'/city-explorer/'},'See the San Francisco case study  ↗'));
  const action = (text, hash = '') => node('a', {class:'city-entry-action', href:`/city-explorer/${hash}`}, text);
  const card = node('article', {class:'start-card city-entry-feature'}, [
    node('p', {class:'eyebrow'}, 'SAN FRANCISCO · RECORDED STUDY · MAP QUALIFICATION OPEN'),
    node('h3', {}, 'Would a second depot help?'),
    node('p', {}, 'A recorded synthetic study on sourced streets. Compare depots, follow one vehicle, then read the map and its limits.'),
    node('div', {class:'city-entry-actions'}, [action('Compare depots', '#compare'), action('Follow a vehicle', '#replay'), action('Map & limits', '#limits')]),
  ]);
  startGrid.insertBefore(card, startGrid.children[1] ?? null);
  const boundary = home.querySelector('.welcome-boundary');
  boundary?.appendChild(node('p', {class:'hosted-trust-legend'}, 'Synthetic teaching results · simulation only · not real-world safety evidence. Running a model does not authenticate its outputs, evaluate authorization, or grant permission to deploy a vehicle or policy.'));
  const catalog = node('section', {class:'city-entry-catalog', 'aria-labelledby':'city-catalog-title'}, [
    node('div', {}, [
      node('p', {class:'city-entry-eyebrow'}, 'RECORDED CITY CASE STUDY'),
      node('h2', {id:'city-catalog-title'}, 'Take the question into San Francisco.'),
      node('p', {}, 'Inspect a twelve-pair depot experiment on sourced roads. Follow a recorded journey, compare depots, and inspect the map qualification hold.'),
    ]), action('Open City Explorer  ↗'),
  ]);
  // Featured questions and the recorded case study are discoverable before the complete library.
  catalogGrid.parentNode.insertBefore(catalog, doc.querySelector('.catalog-library-title'));
  // The depot flow lab rebuilds its hero on every lesson change; the next-lesson line sits under the
  // Compare help text, below the first-screen action, and the observer restores it after a rebuild.
  const linkCapacity = () => {
    const help = flowHero.querySelector('p.flow-run-help');
    if (help && !doc.getElementById('capacity-entry')) help.parentNode.insertBefore(node('p', {class:'flow-next-lesson'}, ['Next lesson: ', node('a', {id:'capacity-entry', href:'/network-flows/capacity/'}, 'Scheduling or capacity?')]), help.nextSibling);
  };
  linkCapacity();
  new MutationObserver(linkCapacity).observe(flowHero, {childList:true});
  networkQuestions.insertBefore(node('article', {class:'network-question capacity-entry-catalog', 'aria-labelledby':'capacity-catalog-title'}, [
      node('p', {class:'city-entry-eyebrow'}, 'RECORDED CAPACITY STUDY'),
      node('h3', {id:'capacity-catalog-title'}, 'Change the schedule—or add capacity?'),
      node('p', {class:'network-description'}, 'Twelve invented visits share data and energy resources. Compare one change, follow a vehicle, and find the limiting resource.'),
      node('a', {class:'city-entry-action', href:'/network-flows/capacity/'}, 'Open the capacity study  ↗'),
  ]), networkQuestions.firstChild);
  const capacityRoadmap=doc.querySelector('[data-roadmap-lesson="capacity"]');
  if (!capacityRoadmap) throw new Error('FleetLab capacity availability contract changed');
  capacityRoadmap.setAttribute('data-availability','available');
  capacityRoadmap.querySelector('.eyebrow').textContent='AVAILABLE';
  capacityRoadmap.querySelector('p:not(.eyebrow)').textContent='Compare scheduling, bandwidth and charging power in the published synthetic study. Follow a vehicle and inspect the limiting resource.';
  capacityRoadmap.appendChild(node('a',{href:'/network-flows/capacity/',class:'city-entry-action'},'Open the capacity study  ↗'));
  doc.querySelector('.studio-footer').appendChild(node('div', {class:'offline-edition'}, [
    node('div', {}, [node('strong', {}, 'Take the teaching labs with you.'), node('p', {}, 'Save the single HTML file, then open it in a browser. Includes the core teaching labs and catalog. The hosted capacity study, film, SF map and recordings are not included; there is no sync with the hosted site.')]),
    node('a', {href:'/downloads/fleetlab-offline', download:'fleetlab-offline.html'}, 'Download offline edition · 2.4 MB ↓'),
    node('a', {href:'/downloads/verify-offline.txt'}, 'Verify the download · SHA-256'),
    node('p', {}, 'No app analytics. Cloudflare receives hosting requests and may receive browser network-error reports.'),
  ]));
  doc.querySelector('.studio-footer').appendChild(node('div', {class:'owner-contact'}, [
    node('span', {}, 'Built by Bo-Huei Lin · Ideas, questions or collaboration?'),
    node('a', {href:'mailto:bohueilin@gmail.com'}, 'bohueilin@gmail.com'),
  ]));
}
