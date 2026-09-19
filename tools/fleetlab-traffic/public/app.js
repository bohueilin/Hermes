const form = document.querySelector('#estimate-form');
const status = document.querySelector('#status');
const button = document.querySelector('#submit');
const result = document.querySelector('#result');
const inputs = document.querySelector('#inputs');
let configured = false;
let busy = false;
let controller;
function localInput(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
form.elements.departure.value = localInput(new Date(Date.now() + 3600000));
form.elements.departure.min = localInput(new Date(Date.now() + 60000));
form.elements.departure.max = localInput(new Date(Date.now() + 7 * 86400000));
document.querySelector('#timezone').textContent = `Time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}. The request uses the corresponding UTC time.`;
function clear() {
  result.hidden = true;
  for (const id of ['route-context','traffic-duration','static-duration','estimate-context','exact-values']) document.getElementById(id).textContent = '';
}
form.addEventListener('input', () => { clear(); if (configured && !busy) status.textContent = 'Configured. Request an estimate for the current inputs.'; });
document.querySelector('#clear').addEventListener('click', clear);
window.addEventListener('pagehide', () => { controller?.abort(); clear(); });
window.addEventListener('pageshow', () => { clear(); });
async function loadStatus() {
  try {
    const response = await fetch('/api/status', {cache: 'no-store'});
    if (!response.ok) throw Error();
    const data = await response.json();
    configured = data.state === 'configured';
    status.textContent = configured ? 'Configured — connection not tested. Submit once to request an estimate.' : 'Unconfigured — no server-side Google Maps key. The default FleetLab simulation remains synthetic.';
    button.disabled = !configured;
  } catch { status.textContent = 'Error — local companion is unavailable. No estimate has been requested.'; }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!configured || busy || !form.reportValidity()) return;
  clear();
  const data = new FormData(form);
  const departure = new Date(data.get('departure'));
  if (!Number.isFinite(departure.getTime()) || departure <= new Date() || departure.getTime() > Date.now() + 7 * 86400000) {
    status.textContent = 'Choose a future departure within seven days.'; return;
  }
  const input = {origin: {latitude: Number(data.get('originLatitude')), longitude: Number(data.get('originLongitude'))},
    destination: {latitude: Number(data.get('destinationLatitude')), longitude: Number(data.get('destinationLongitude'))},
    departureTime: departure.toISOString(), trafficModel: data.get('trafficModel')};
  busy = true; button.disabled = true; inputs.disabled = true; controller = new AbortController();
  status.textContent = 'Requesting one Google Maps estimate…';
  try {
    const response = await fetch('/api/estimate', {method: 'POST', cache: 'no-store', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input), signal: controller.signal});
    const estimate = await response.json();
    if (!response.ok || estimate.state !== 'connected') {
      status.textContent = estimate.message || 'Error — no estimate is available.'; return;
    }
    status.textContent = 'Connected — one estimate returned. No automatic refresh.';
    document.querySelector('#route-context').textContent = `${estimate.origin.latitude}, ${estimate.origin.longitude} → ${estimate.destination.latitude}, ${estimate.destination.longitude}`;
    document.querySelector('#traffic-duration').textContent = `${(estimate.durationSeconds / 60).toFixed(1)} min`;
    document.querySelector('#static-duration').textContent = `${(estimate.staticDurationSeconds / 60).toFixed(1)} min`;
    document.querySelector('#estimate-context').textContent = `Departure: ${new Date(estimate.departureTime).toLocaleString()} (${estimate.departureTime}). Model: ${estimate.trafficModel}. Distance: ${(estimate.distanceMeters / 1000).toFixed(1)} km. Retrieved: ${estimate.fetchedAt}.`;
    document.querySelector('#exact-values').textContent = `duration: ${estimate.duration}\nstaticDuration: ${estimate.staticDuration}\ndistanceMeters: ${estimate.distanceMeters}`;
    result.hidden = false;
  } catch { status.textContent = 'Error — no estimate is available. No automatic retry was made.'; }
  finally { busy = false; inputs.disabled = false; button.disabled = !configured; controller = undefined; }
});
loadStatus();
