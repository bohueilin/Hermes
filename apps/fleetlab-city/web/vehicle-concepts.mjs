// Design-reference learning only. Nothing in this module changes a recorded run.
const references = {
  fleetlab: {
    eyebrow: '01 / THE RECORDED FLEET',
    name: 'Generic EV',
    caption: 'The vehicle FleetLab actually models',
    image: 'assets/vehicle-generic.svg',
    alt: 'Original side-view illustration of a generic electric car',
    provenance: 'MODEL ASSUMPTION',
    intro: 'One homogeneous fleet makes the depot question easier to isolate. The recorded SF experiment uses 100 generic EVs with 30 kWh initial energy and a 48 kWh charging target. The 60 kWh nominal capacity field is unused metadata.',
    cues: ['Same vehicle assumptions in both depot layouts', 'Graph travel, energy, charging and turnaround resources', 'No operator hardware, driving policy or vehicle dynamics'],
    question: 'With fleet and total resources held fixed, how does depot placement change service, empty travel and queues?',
    next: 'Keep this as the controlled baseline. A later vehicle-class comparison would need a frozen scenario, measured class inputs and separate validation.',
  },
  ojai: {
    eyebrow: '02 / PURPOSE-BUILT DESIGN',
    name: 'Waymo Ojai',
    caption: 'A rider-first design reference',
    image: 'assets/vehicle-ojai-concept.svg',
    alt: 'Original concept illustration of a tall, rounded rider-first electric shuttle; not a depiction of Ojai hardware',
    provenance: 'SOURCED DESIGN REFERENCE',
    intro: 'Waymo describes the Ojai with elevator-like doors, a low step, a flat floor and accessibility features. These are design cues, not FleetLab vehicle parameters.',
    cues: ['Entry geometry and cabin layout invite a boarding-time question', 'Accessibility features invite service-quality and dwell-time measurement', 'Charging and turnaround interfaces invite depot workflow study'],
    question: 'Would measured boarding, accessible pickup and depot service times change the best depot layout or shift schedule?',
    next: 'Collect observed dwell distributions by rider and stop context, vehicle energy/charging curves, service task times and accessibility outcomes before a vehicle-class experiment.',
    source: 'https://community.waymo.com/blog/2026/05/welcoming-riders-in-the-ojai/',
    sourceLabel: 'Waymo / Ojai announcement · 28 May 2026',
  },
  zoox: {
    eyebrow: '03 / BIDIRECTIONAL DESIGN',
    name: 'Zoox robotaxi',
    caption: 'A direction-flexible design reference',
    image: 'assets/vehicle-bidi-concept.svg',
    alt: 'Original concept illustration of a symmetric bidirectional shuttle; not a depiction of Zoox hardware',
    provenance: 'SOURCED DESIGN REFERENCE',
    intro: 'Zoox describes a vehicle with no fixed front or back, four wheel steering and automatic doors. FleetLab does not model any of those maneuvers.',
    cues: ['Travel heading can differ from a fixed vehicle orientation', 'Curb access and pickup placement become explicit questions', 'Four wheel steering requires a different maneuver model'],
    question: 'Could qualified bidirectional operation change pickup placement, curb dwell or depot circulation under local access rules?',
    next: 'Measure curb and depot geometry, permitted maneuvers, direction-specific travel time, dwell and energy. Validate with a suitable traffic or motion model before using outcomes.',
    source: 'https://zoox.com/know-your-ride',
    sourceLabel: 'Zoox / Know Your Ride · accessed 29 Sep 2026',
  },
};

function node(tag, className, content) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (content !== undefined) result.textContent = content;
  return result;
}

function addText(parent, tag, className, content) {
  const result = node(tag, className, content);
  parent.append(result);
  return result;
}

function sectionTitle(parent, label, title) {
  const wrapper = node('div', 'vehicle-concepts__heading');
  addText(wrapper, 'p', 'vehicle-concepts__eyebrow', label);
  addText(wrapper, 'h2', '', title);
  parent.append(wrapper);
}

function createCard(key, data) {
  const card = node('article', 'vehicle-concepts__card');
  const button = node('button', 'vehicle-concepts__card-button');
  button.type = 'button';
  button.dataset.vehicleConcept = key;
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-controls', 'vehicle-concepts-detail');
  const art = node('span', 'vehicle-concepts__art');
  const image = node('img');
  image.src = new URL(data.image, import.meta.url).href;
  image.alt = data.alt;
  image.width = 600;
  image.height = 250;
  art.append(image);
  button.append(art);
  addText(button, 'span', 'vehicle-concepts__number', data.eyebrow);
  addText(button, 'strong', 'vehicle-concepts__card-title', data.name);
  addText(button, 'span', 'vehicle-concepts__card-caption', data.caption);
  addText(button, 'span', 'vehicle-concepts__card-action', 'Explore design questions ↗');
  card.append(button);
  if (data.source) {
    const link = addText(card, 'a', 'vehicle-concepts__source', data.sourceLabel + ' ↗');
    link.href = data.source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  } else {
    addText(card, 'span', 'vehicle-concepts__source', 'FleetLab SF scenario · recorded assumption');
  }
  return { card, button };
}

function makeDetail() {
  const detail = node('article', 'vehicle-concepts__detail');
  detail.id = 'vehicle-concepts-detail';
  detail.setAttribute('aria-label', 'Selected vehicle design learning questions');
  const top = node('div', 'vehicle-concepts__detail-top');
  const label = addText(top, 'p', 'vehicle-concepts__eyebrow');
  const title = addText(top, 'h3');
  const badge = addText(top, 'span', 'vehicle-concepts__badge');
  detail.append(top);
  const intro = addText(detail, 'p', 'vehicle-concepts__detail-intro');
  const columns = node('div', 'vehicle-concepts__columns');
  const cuesPanel = node('div');
  addText(cuesPanel, 'h4', '', 'Design cues to investigate');
  const cues = node('ul', 'vehicle-concepts__cues');
  cuesPanel.append(cues);
  const questionPanel = node('div', 'vehicle-concepts__question');
  addText(questionPanel, 'h4', '', 'Operational question');
  const question = addText(questionPanel, 'p');
  columns.append(cuesPanel, questionPanel);
  detail.append(columns);
  const next = node('div', 'vehicle-concepts__next');
  addText(next, 'span', '', 'BEFORE A VEHICLE-CLASS EXPERIMENT');
  const nextText = addText(next, 'p');
  detail.append(next);
  return { detail, label, title, badge, intro, cues, question, nextText };
}

function makeDirectionSketch() {
  const aside = node('aside', 'vehicle-concepts__sketch');
  aside.hidden = true;
  addText(aside, 'p', 'vehicle-concepts__eyebrow', 'A CONCEPTUAL DIRECTION SKETCH');
  addText(aside, 'h4', '', 'Same orientation. Different travel heading.');
  const stage = node('div', 'vehicle-concepts__stage');
  stage.setAttribute('role', 'img');
  const vehicle = node('div', 'vehicle-concepts__sketch-vehicle');
  addText(vehicle, 'span', '', 'A');
  addText(vehicle, 'span', '', 'B');
  const arrow = addText(stage, 'span', 'vehicle-concepts__travel-arrow', '→');
  stage.append(vehicle);
  aside.append(stage);
  const controls = node('div', 'vehicle-concepts__direction-controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Illustrated travel heading');
  const towardB = addText(controls, 'button', '', 'Travel toward B →');
  const towardA = addText(controls, 'button', '', '← Travel toward A');
  for (const button of [towardB, towardA]) button.type = 'button';
  aside.append(controls);
  const state = addText(aside, 'p', 'vehicle-concepts__direction-state');
  addText(aside, 'p', 'vehicle-concepts__sketch-note', 'Illustration only. No route, speed, turn, curb interaction or safety outcome has been simulated. Direction does not grant road access.');
  function setHeading(side) {
    const towardRight = side === 'B';
    arrow.textContent = towardRight ? '→' : '←';
    stage.setAttribute('aria-label', `Symmetric shuttle stays oriented the same way; illustrated travel heading is toward ${side}`);
    towardB.setAttribute('aria-pressed', String(towardRight));
    towardA.setAttribute('aria-pressed', String(!towardRight));
    state.textContent = `Illustrated heading: toward ${side}. Vehicle orientation: unchanged.`;
  }
  towardB.addEventListener('click', () => setHeading('B'));
  towardA.addEventListener('click', () => setHeading('A'));
  setHeading('B');
  return aside;
}

export function mountVehicleConcepts(hostElement) {
  if (!(hostElement instanceof HTMLElement)) throw new TypeError('Vehicle concepts require an HTML host element');
  const root = node('section', 'vehicle-concepts');
  root.setAttribute('aria-label', 'Vehicle design learning gallery');
  const mast = node('div', 'vehicle-concepts__mast');
  sectionTitle(mast, 'EXPLORE THE NEXT QUESTION / VEHICLE DESIGN', 'The shape of the fleet changes the question.');
  addText(mast, 'p', '', 'Start with the vehicle FleetLab ran. Explore two public design references, then ask which measurements and model fidelity would be needed to test them.');
  root.append(mast);
  const gallery = node('div', 'vehicle-concepts__gallery');
  gallery.setAttribute('role', 'group');
  gallery.setAttribute('aria-label', 'Choose a vehicle design reference');
  const buttons = new Map();
  for (const [key, data] of Object.entries(references)) {
    const { card, button } = createCard(key, data);
    buttons.set(key, button);
    gallery.append(card);
  }
  root.append(gallery);
  const selected = makeDetail();
  root.append(selected.detail);
  const sketch = makeDirectionSketch();
  root.append(sketch);
  const note = node('p', 'vehicle-concepts__boundary');
  note.append(node('strong', '', 'Model boundary. '), document.createTextNode('The recorded results remain 100 generic EVs in a graph/resource simulation. The Ojai and Zoox references are not simulated operator vehicles. This gallery provides no driving, safety, regulatory or deployment conclusion.'));
  root.append(note);
  function select(key) {
    const data = references[key];
    if (!data) return;
    for (const [id, button] of buttons) button.setAttribute('aria-pressed', String(id === key));
    selected.label.textContent = `SELECTED / ${data.eyebrow}`;
    selected.title.textContent = data.name;
    selected.badge.textContent = data.provenance;
    selected.intro.textContent = data.intro;
    selected.cues.replaceChildren(...data.cues.map(cue => node('li', '', cue)));
    selected.question.textContent = data.question;
    selected.nextText.textContent = data.next;
    sketch.hidden = key !== 'zoox';
  }
  gallery.addEventListener('click', event => {
    const button = event.target.closest('button[data-vehicle-concept]');
    if (button && gallery.contains(button)) select(button.dataset.vehicleConcept);
  });
  hostElement.replaceChildren(root);
  select('fleetlab');
  return { select, destroy: () => { if (root.parentNode === hostElement) root.remove(); } };
}
