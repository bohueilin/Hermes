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
      node('p', {class:'city-entry-note'}, 'Recorded experiments · synthetic operations · map qualification in progress'),
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
  const firstLesson = home.querySelector('.loop-section');
  home.insertBefore(feature, firstLesson);
  const catalog = node('section', {class:'city-entry-catalog', 'aria-labelledby':'city-catalog-title'}, [
    node('div', {}, [
      node('p', {class:'city-entry-eyebrow'}, 'RECORDED CITY CASE STUDY'),
      node('h2', {id:'city-catalog-title'}, 'Take the question into San Francisco.'),
      node('p', {}, 'Inspect a twelve-pair depot experiment on sourced roads. The notebook and replay explain a recorded study; the interactive lessons below let you run their own teaching models.'),
    ]), action('Open City Explorer  ↗'),
  ]);
  catalogIntro.parentNode.insertBefore(catalog, catalogIntro.nextSibling);
}
