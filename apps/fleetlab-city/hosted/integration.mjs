// Hosted FleetLab entry points. The standalone teaching/offline build is unchanged.
// No City renderer, recordings or map data load until the visitor follows a link.
export function mountCityEntry(doc = document) {
  if (doc.getElementById('city-explorer-entry')) return;
  const nav = doc.getElementById('studio-navigation');
  const fleetDay = nav?.querySelector('[data-nav="simulation"]');
  const home = doc.querySelector('.studio-overview');
  const catalogIntro = doc.querySelector('.simulation-catalog .catalog-intro');
  if (!fleetDay || !home || !catalogIntro) throw new Error('FleetLab hosted entry contract changed');
  const node = (tag, attrs, children) => {
    const element = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) element.setAttribute(key, value);
    for (const child of [children].flat().filter(value => value != null)) {
      element.appendChild(typeof child === 'string' ? doc.createTextNode(child) : child);
    }
    return element;
  };
  const link = node('a', {id:'city-explorer-entry', href:'/city-explorer/'}, 'City Explorer');
  nav.insertBefore(link, fleetDay.nextSibling);
  const action = (text, hash = '') => node('a', {class:'city-entry-action', href:`/city-explorer/${hash}`}, text);
  const feature = node('section', {class:'city-entry-feature', 'aria-labelledby':'city-entry-title'}, [
    node('div', {class:'city-entry-copy'}, [
      node('p', {class:'city-entry-eyebrow'}, 'NEW IN FLEETLAB / CITY EXPLORER'),
      node('h2', {id:'city-entry-title'}, 'San Francisco, one working day.'),
      node('p', {class:'city-entry-lede'}, 'Explore a sourced city map, compare depot decisions, then follow one vehicle’s trips and queues.'),
      action('Explore San Francisco  ↗'),
      node('p', {class:'city-entry-note'}, 'Browse precomputed SF experiments. These controls select recordings; they do not run a new city simulation. Synthetic operations · map qualification in progress.'),
      node('p', {class:'city-entry-note'}, ['Map qualification is open: the routing map still needs source and scope checks, including independent human review. ', action('Read the review status →', '#limits')]),
    ]),
    node('div', {class:'city-entry-journey', 'aria-label':'Three ways to explore San Francisco'}, [
      node('div', {class:'city-entry-place'}, [node('span', {}, '37.77° N / 122.42° W'), node('strong', {}, 'A city. A fleet. A question.')]),
      node('ol', {}, [
        ['01', 'Explore the map', 'Sourced streets, visible gaps.'],
        ['02', 'Compare the decision', 'One depot or two. Equal resources.'],
        ['03', 'Follow the day', 'Trips, charging and the time between.'],
      ].map(([number, title, detail]) => node('li', {}, [node('span', {class:'city-entry-number'}, number), node('div', {}, [node('strong', {}, title), node('p', {}, detail)])]))),
      node('span', {class:'city-entry-shift'}, 'SAN FRANCISCO  /  07:00 — 15:00'),
    ]),
  ]);
  const boundary = home.querySelector('.welcome-boundary');
  boundary?.appendChild(node('p', {class:'hosted-trust-legend'}, 'Synthetic teaching results · simulation only · not real-world safety evidence. Running a model does not authenticate its outputs, evaluate authorization, or grant permission to deploy a vehicle or policy.'));
  const firstLesson = home.querySelector('.loop-section');
  home.insertBefore(feature, firstLesson);
  const guide = node('section', {class:'lab-guide', 'aria-labelledby':'lab-guide-title'}, [
    node('p', {class:'city-entry-eyebrow'}, 'PREFER TO CHANGE AN INPUT AND RUN A MODEL?'),
    node('h2', {id:'lab-guide-title'}, 'Pick a question. Find your lab.'),
    node('p', {}, 'These four teaching models run in your browser. Each has its own assumptions and vehicles; they do not share the San Francisco recordings.'),
    node('div', {class:'lab-guide-grid'}, [
      ['fleet-day','Fleet day','What keeps a fleet available?','Weather, energy and depot work across one day.'],
      ['street-lab','Street lab','Where do local queues form?','Routing and block-level queues on sourced streets.'],
      ['experiments','Four-area experiments','Does a policy help across repeats?','Paired dispatch and recall experiments with guardrails.'],
      ['scale-lab','Scale lab','What changes as a fleet grows?','Density, fleet intake and support-pool capacity.'],
    ].map(([path,title,question,detail]) => node('a', {href:`/#/${path}`}, [
      node('span', {class:'lab-guide-name'}, `${title} ↗`), node('h3', {}, question), node('p', {}, detail),
    ]))),
  ]);
  home.insertBefore(guide, firstLesson);
  const catalog = node('section', {class:'city-entry-catalog', 'aria-labelledby':'city-catalog-title'}, [
    node('div', {}, [
      node('p', {class:'city-entry-eyebrow'}, 'RECORDED CITY CASE STUDY'),
      node('h2', {id:'city-catalog-title'}, 'Take the question into San Francisco.'),
      node('p', {}, 'Inspect a twelve-pair depot experiment on sourced roads. The notebook and replay explain a recorded study; the interactive lessons below let you run their own teaching models.'),
    ]), action('Open City Explorer  ↗'),
  ]);
  catalogIntro.parentNode.insertBefore(catalog, catalogIntro.nextSibling);
  doc.querySelector('.studio-footer').appendChild(node('div', {class:'offline-edition'}, [
    node('div', {}, [node('strong', {}, 'Take the teaching labs with you.'), node('p', {}, 'Save the single HTML file, then open it in a browser. Includes the core teaching labs and catalog. The SF map and recordings, hosted film and later City Explorer lessons are not included; there is no sync with the hosted site.')]),
    node('a', {href:'/downloads/fleetlab-offline', download:'fleetlab-offline.html'}, 'Download offline edition · 2.4 MB ↓'),
  ]));
  doc.querySelector('.studio-footer').appendChild(node('div', {class:'owner-contact'}, [
    node('span', {}, 'Built by Bo-Huei Lin · Ideas, questions or collaboration?'),
    node('a', {href:'mailto:bohueilin@gmail.com'}, 'bohueilin@gmail.com'),
  ]));
}
