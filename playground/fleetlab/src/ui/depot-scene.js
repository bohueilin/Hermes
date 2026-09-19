// Conceptual service-flow illustration. Geometry is explanatory, never a simulated vehicle or depot state.
import { el } from "./dom.js";

const STAGES = [
  { id: "arrive", name: "Arrive", label: "01 / ARRIVAL", title: "A parking space is a resource.", text: "Returning vehicles need a place to wait. A full lot can redirect a vehicle to another depot, adding an empty drive before service even begins.", question: "Where should a returning vehicle go?", color: "#a8b9b3" },
  { id: "clean", name: "Clean", label: "02 / CLEANING", title: "A free bay changes the queue.", text: "Vehicles wait for a cleaning bay, then occupy it for the configured service time. More bays and a shorter process are different ways to increase capacity.", question: "Add two bays, or shorten each clean?", color: "#d5a960" },
  { id: "service", name: "Service", label: "03 / SERVICE", title: "Work continues after cleaning.", text: "Vehicles that are due for service join a separate queue. Relieving the cleaning queue can move the bottleneck here. This regional model excludes staffing and charging.", question: "Did we remove the bottleneck or move it?", color: "#7c9c99" },
  { id: "ready", name: "Ready", label: "04 / RELEASE", title: "Ready here is not available everywhere.", text: "A ready vehicle can be dispatched from the depot. Morning release repositions ready vehicles outside their home area. Travel time still matters for the next pickup.", question: "Will the fleet be in the right area for the peak?", color: "#28725a" },
];

function svg(tag, attrs = {}, children = []) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  for (const child of children) node.appendChild(child);
  return node;
}

const point = (x, y, z = 0) => [356 + (x - y) * .95, 75 + (x + y) * .49 - z];
const points = (corners) => corners.map((p) => point(...p).join(",")).join(" ");
const polygon = (corners, fill, extra = {}) => svg("polygon", { points: points(corners), fill, ...extra });

function slab(x, y, w, d, h, top, front, side) {
  return svg("g", {}, [
    polygon([[x,y,h],[x+w,y,h],[x+w,y+d,h],[x,y+d,h]],top),
    polygon([[x,y+d,h],[x+w,y+d,h],[x+w,y+d,0],[x,y+d,0]],front),
    polygon([[x+w,y,h],[x+w,y+d,h],[x+w,y+d,0],[x+w,y,0]],side),
  ]);
}

function line(corners, color, width = 1, extra = {}) {
  return svg("polyline", { points: points(corners), fill:"none", stroke:color, "stroke-width":width, ...extra });
}

function car(x, y, color = "#ffffff") {
  return svg("g", {}, [
    polygon([[x-2,y+4],[x+24,y+4],[x+24,y+17],[x-2,y+17]],"#1c322e",{opacity:".13"}),
    slab(x,y,23,12,7,color,"#b7c5bd","#80998c"),
    slab(x+5,y+1,12,10,11,color,"#70918e","#284c49"),
    line([[x+4,y+12,2],[x+7,y+12,2]],"#253c36",3),
    line([[x+17,y+12,2],[x+20,y+12,2]],"#253c36",3),
  ]);
}

function canopy(x, y, w, d, roof) {
  const group = svg("g");
  group.appendChild(polygon([[x,y],[x+w+15,y],[x+w+15,y+d+9],[x,y+d+9]],"#193f33",{opacity:".1"}));
  for (const [px,py] of [[x+3,y+3],[x+w-6,y+3],[x+3,y+d-6],[x+w-6,y+d-6]]) {
    group.appendChild(slab(px,py,3,3,34,"#f5f3e8","#a2b8ae","#6c8b7e"));
  }
  group.appendChild(polygon([[x,y,38],[x+w,y,38],[x+w,y+d,38],[x,y+d,38]],roof));
  group.appendChild(line([[x,y+d,38],[x+w,y+d,38],[x+w,y,38]],"#466b90",2));
  for (let i=12;i<w;i+=14) group.appendChild(line([[x+i,y+4,38],[x+i,y+d-4,38]],"#ffffff",1,{opacity:".38"}));
  return group;
}

/** Returns a keyboard-operable conceptual depot diagram; no simulation values are accepted or generated. */
export function createDepotScene() {
  const drawing = svg("svg", { viewBox:"0 0 720 435", role:"img", "aria-label":"Conceptual depot service flow: arrival parking, cleaning bays, service bays and vehicles ready for release. Illustrative geometry, not a run." });
  const background = svg("g", { opacity:".55" });
  for (let x=-40;x<470;x+=30) background.appendChild(line([[x,-35],[x,330]],"#cddbe9",.6));
  for (let y=-35;y<340;y+=30) background.appendChild(line([[-40,y],[440,y]],"#cddbe9",.6));
  drawing.appendChild(background);
  drawing.appendChild(polygon([[-12,1],[389,1],[389,305],[-12,305]],"#315678",{opacity:".08",transform:"translate(9 17)"}));
  drawing.appendChild(slab(0,0,370,285,7,"#d8e4ef","#bccedc","#a7becf"));
  drawing.appendChild(polygon([[12,12,8],[358,12,8],[358,273,8],[12,273,8]],"#f2f6fa"));
  // The lane is a design convention, not a modeled internal road network.
  drawing.appendChild(polygon([[17,122,9],[353,122,9],[353,153,9],[17,153,9]],"#9ab0c3"));
  drawing.appendChild(polygon([[160,15,9],[186,15,9],[186,270,9],[160,270,9]],"#9ab0c3"));
  drawing.appendChild(line([[20,137,9],[350,137,9]],"#f2f7fd",1.5,{"stroke-dasharray":"8 8"}));
  drawing.appendChild(line([[173,20,9],[173,269,9]],"#f2f7fd",1.5,{"stroke-dasharray":"8 8"}));
  const zones = {};
  for (const [id,x,y,w,d,color] of [["clean",24,25,120,83,"#d7e6ff"],["service",207,25,133,83,"#d8e4ed"],["arrive",24,170,120,86,"#e0e8ef"],["ready",207,170,133,86,"#d3e8e5"]]) {
    const zone = svg("g", { "data-scene-stage":id });
    zone.appendChild(polygon([[x,y,9],[x+w,y,9],[x+w,y+d,9],[x,y+d,9]],color));
    for (let slot=0;slot<4;slot++) {
      zone.appendChild(line([[x+8+slot*28,y+6,10],[x+8+slot*28,y+d-5,10]],"#ffffff",1.5));
      if (slot !== 2) zone.appendChild(car(x+11+slot*28,y+39,id === "ready" ? "#79b6cb" : "#ffffff"));
    }
    if (id === "clean" || id === "service") zone.appendChild(canopy(x+3,y+3,w-6,37,id === "clean" ? "#76a4e4" : "#87a9c0"));
    if (id === "service") zone.appendChild(slab(x+100,y+48,20,20,19,"#b6cddc","#86a4ba","#547c9a"));
    zones[id] = zone;
    drawing.appendChild(zone);
  }
  drawing.appendChild(car(111,133));
  drawing.appendChild(car(267,133,"#79b6cb"));
  // Small landscaping blocks establish the edge of the explanatory site without geographic claims.
  for (const [x,y] of [[7,16],[7,65],[7,215],[353,22],[353,222],[321,268]]) {
    drawing.appendChild(slab(x,y,9,15,13,"#91b9a5","#6b9580","#4d7565"));
  }
  const detail = el("div", { class:"depot-detail", "data-role":"stage-detail", role:"status" });
  const stageButtons = STAGES.map((stage) => el("button", { type:"button", "data-stage":stage.id, "aria-pressed":"false", on:{click:()=>select(stage.id)} }, [el("span", {class:"stage-number"},stage.label.slice(0,2)),stage.name]));
  function select(id) {
    const stage = STAGES.find((s) => s.id === id);
    for (const b of stageButtons) b.setAttribute("aria-pressed",String(b.getAttribute("data-stage") === id));
    for (const [key,zone] of Object.entries(zones)) zone.setAttribute("opacity",key === id ? "1" : ".58");
    detail.replaceChildren(el("p",{class:"eyebrow"},stage.label),el("h3",{},stage.title),el("p",{},stage.text),el("p",{class:"depot-question"},stage.question));
  }
  const node = el("section", { class:"depot-scene", "aria-label":"Explore a depot" }, [
    el("div",{class:"scene-visual"},[
      el("div",{class:"scene-heading"},[el("span",{class:"eyebrow"},"BETWEEN ONE TRIP AND THE NEXT"),el("span",{class:"quiet-badge"},"Conceptual depot")]),
      drawing,
    ]),
    el("div",{class:"scene-explainer"},[
      el("p",{class:"scene-invitation"},"Explore the work behind the ride."),
      el("div",{class:"stage-tabs",role:"group","aria-label":"Depot service stages"},stageButtons),detail,
      el("p",{class:"scene-note"},"Select a stage to explore. Regional experiment model; illustrative layout and vehicles."),
    ]),
  ]);
  select("clean");
  return node;
}
