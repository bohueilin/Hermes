// Explicit hosted-only owner for the approved current-request dispatch lesson.
export const R3_DIR='network-flows/dispatch';
export const R3_RELEASE=`${R3_DIR}/release.json`;
export const R3_FILES=[`${R3_DIR}/index.html`,`${R3_DIR}/boot.js`,`${R3_DIR}/visual.css`,R3_RELEASE];
export const R3_ENTRIES=['src/ui/dispatch-app.js','src/runtime/dispatch-worker.js'];
export const R3_MODULES=new Set([...R3_ENTRIES,'src/model/dispatch-contract.js','src/model/dispatch.js','src/model/dispatch-verify.js','src/runtime/dispatch-job.js','src/runtime/dispatch-session.js']);
export const R3_BOOT='import { startDispatch } from "../../src/ui/dispatch-app.js";\nstartDispatch({ createWorker: () => new Worker(new URL("../../src/runtime/dispatch-worker.js", import.meta.url), { type: "module" }) });\n';
import {hostedRoutePackage} from "./hosted-route-package.mjs";
export const R3_SOURCE_ASSETS=['dispatch/index.html', 'dispatch/visual.css', 'tools/pack.mjs', 'tools/hosted-route-package.mjs', 'tools/dispatch-package.mjs', 'tools/software-delivery-package.mjs', 'tools/release-sidecar.mjs', 'tools/site-shell.mjs', 'tools/check-dist.mjs', 'tools/media.mjs', 'tools/comment-strip.mjs'];
const pack=hostedRoutePackage({name:'dispatch',dir:R3_DIR,releasePath:R3_RELEASE,routeFiles:R3_FILES,entries:R3_ENTRIES,modules:R3_MODULES,sourceAssets:R3_SOURCE_ASSETS,schema:'fleetlab.dispatch-release/1.0.0',scope:'R3_DISPATCH_ROUTE_CLOSURE_V1'});
export const createR3Sidecar=pack.create, r3PackageProblems=pack.problems;
