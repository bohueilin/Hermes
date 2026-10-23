// Validate actual recorded browser observations, not a substitute for running a browser.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidencePath = path.join(root,'build/fleetlab-city/validation/browser/evidence.json');
if (!fs.existsSync(evidencePath)) throw new Error('Browser evidence unavailable: inspect the real UI first');
const evidence = JSON.parse(fs.readFileSync(evidencePath));
for (const size of ['1440x900','768x1000','390x844']) {
  const observation = evidence.viewports.find(v=>v.size===size);
  if (!observation || observation.pageOverflow !== false) throw new Error(`Missing/failed viewport ${size}`);
}
for (const check of ['recordedReplay','keyboardSeek','flatRenderer','missingTrace','incompatible','invalid','incomplete','sensitivitiesVisible']) {
  if (evidence.checks[check] !== 'PASS') throw new Error(`Missing/failed observed check: ${check}`);
}
for (const file of evidence.screenshots) {
  if (path.basename(file.name) !== file.name) throw new Error('Unsafe screenshot path');
  const bytes = fs.readFileSync(path.join(path.dirname(evidencePath),file.name));
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('Screenshot hash mismatch');
}
console.log(JSON.stringify({pass:true,scope:'Recorded local browser observations only',browser:evidence.browser,notRun:evidence.notRun},null,2));
