// Optional provider boundary. No file writes, retries, response cache, or logging.
const ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const FIELD_MASK = 'routes.duration,routes.staticDuration,routes.distanceMeters,fallbackInfo';
const MODELS = new Set(['BEST_GUESS', 'OPTIMISTIC', 'PESSIMISTIC']);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export class TrafficError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = 'TrafficError';
    this.code = code;
    this.status = status;
  }
}
const invalid = () => new TrafficError('INVALID_INPUT', 'Invalid request: use valid coordinates, a supported model, and a UTC departure in the next seven days.', 400);
function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function point(value) {
  return exactKeys(value, ['latitude', 'longitude']) && Number.isFinite(value.latitude)
    && Number.isFinite(value.longitude) && Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180;
}
export function validateEstimate(input, now = Date.now()) {
  if (!exactKeys(input, ['origin', 'destination', 'departureTime', 'trafficModel'])
    || !point(input.origin) || !point(input.destination) || !MODELS.has(input.trafficModel)
    || typeof input.departureTime !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input.departureTime)) throw invalid();
  const departure = Date.parse(input.departureTime);
  const canonicalInput = input.departureTime.includes('.') ? input.departureTime : input.departureTime.replace('Z', '.000Z');
  if (!Number.isFinite(departure) || departure <= now || departure > now + WEEK_MS
    || new Date(departure).toISOString() !== canonicalInput) throw invalid();
  return {origin: {...input.origin}, destination: {...input.destination}, departureTime: new Date(departure).toISOString(), trafficModel: input.trafficModel};
}
function invalidProvider() {
  return new TrafficError('INVALID_PROVIDER_RESPONSE', 'Google Maps did not return a complete traffic estimate. No result is available.');
}
function seconds(value) {
  if (typeof value !== 'string' || !/^\d{1,6}(?:\.\d{1,9})?s$/.test(value)) throw invalidProvider();
  const number = Number(value.slice(0, -1));
  if (!Number.isFinite(number) || number > 604800) throw invalidProvider();
  return number;
}
async function boundedJSON(response) {
  if (!response.body) throw invalidProvider();
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 65536) { await reader.cancel(); throw invalidProvider(); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { throw invalidProvider(); }
}
export async function computeEstimate(input, {apiKey = '', fetchImpl = globalThis.fetch, now = Date.now} = {}) {
  const validated = validateEstimate(input, now());
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new TrafficError('UNCONFIGURED', 'No server-side Google Maps key is configured. No request was sent.', 503);
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: {'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK},
      body: JSON.stringify({
        origin: {location: {latLng: validated.origin}}, destination: {location: {latLng: validated.destination}},
        departureTime: validated.departureTime, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
        trafficModel: validated.trafficModel, computeAlternativeRoutes: false,
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new TrafficError('PROVIDER_ERROR', 'Google Maps could not complete the request. Check server-side key restrictions, billing, and quota.');
    }
    const data = await boundedJSON(response);
    if (!data || Object.hasOwn(data, 'fallbackInfo') || !Array.isArray(data.routes) || data.routes.length !== 1) throw invalidProvider();
    const route = data.routes[0];
    if (!route || !Number.isSafeInteger(route.distanceMeters) || route.distanceMeters < 0) throw invalidProvider();
    const durationSeconds = seconds(route.duration);
    const staticDurationSeconds = seconds(route.staticDuration);
    return {state: 'connected', provider: 'Google Maps', ...validated, fetchedAt: new Date(now()).toISOString(),
      duration: route.duration, staticDuration: route.staticDuration, durationSeconds, staticDurationSeconds,
      distanceMeters: route.distanceMeters};
  } catch (error) {
    if (error instanceof TrafficError) throw error;
    throw new TrafficError('PROVIDER_ERROR', 'Google Maps could not complete the request. No estimate is available.');
  }
}
