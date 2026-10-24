// Explicit hosted-only owner for the depot stage 1 lab (reconciliation 7.2 Q6, 11.3; engineering note BD-16).
export const DEPOT_DIR='depot-readiness';
export const DEPOT_PAGE=`${DEPOT_DIR}/index.html`;
export const DEPOT_RELEASE=`${DEPOT_DIR}/release.json`;
export const DEPOT_FILES=[DEPOT_PAGE,`${DEPOT_DIR}/boot.js`,`${DEPOT_DIR}/visual.css`,DEPOT_RELEASE];
export const DEPOT_ENTRIES=['src/ui/depot-lab-app.js','src/runtime/depot-lab-worker.js'];
const lab=['allocation','canonical','compare','engine','identity','ledger','policy','presets','profiles','rational','registry','schema','state','task-graph','units'].map(n=>`src/model/depot-lab/${n}.js`);
const verify=['allocation-check','blockage','metrics','policy-check','reconstruct','verify'].map(n=>`src/model/depot-lab-verify/${n}.js`);
export const DEPOT_MODULES=new Set([...DEPOT_ENTRIES,...lab,...verify,'src/runtime/depot-lab-job.js','src/runtime/depot-lab-session.js',
 ...['controls','evidence','format','inspector','share','view'].map(n=>`src/ui/depot-lab-${n}.js`)]);
// Every module of the depot family, by path; an unlisted one fails ownership and copy coverage.
export const DEPOT_MODULE_PATH=/^src\/(?:model\/depot-lab(?:-verify)?\/[a-z0-9-]+|runtime\/depot-lab-[a-z0-9-]+|ui\/depot-lab-[a-z0-9-]+)\.js$/;
export const DEPOT_BOOT='import { startDepotLab } from "../src/ui/depot-lab-app.js";\nstartDepotLab({ createWorker: () => new Worker(new URL("../src/runtime/depot-lab-worker.js", import.meta.url), { type: "module" }) });\n';
import {hostedRoutePackage} from './hosted-route-package.mjs';
export const DEPOT_SOURCE_ASSETS=['depot-lab/index.html','depot-lab/visual.css','tools/pack.mjs','tools/hosted-route-package.mjs','tools/depot-lab-package.mjs','tools/software-delivery-package.mjs','tools/release-sidecar.mjs','tools/site-shell.mjs','tools/check-dist.mjs','tools/media.mjs','tools/comment-strip.mjs'];
const pack=hostedRoutePackage({name:'depot-lab',dir:DEPOT_DIR,releasePath:DEPOT_RELEASE,routeFiles:DEPOT_FILES,entries:DEPOT_ENTRIES,modules:DEPOT_MODULES,sourceAssets:DEPOT_SOURCE_ASSETS,schema:'fleetlab.depot-lab-release/1.0.0',scope:'DEPOT_LAB_ROUTE_CLOSURE_V1'});
export const createDepotSidecar=pack.create,depotPackageProblems=pack.problems;
