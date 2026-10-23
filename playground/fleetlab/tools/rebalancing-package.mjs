// Explicit hosted-only owner for the approved four-zone rebalancing lesson.
export const R1_DIR='network-flows/rebalancing';
export const R1_RELEASE=`${R1_DIR}/release.json`;
export const R1_FILES=[`${R1_DIR}/index.html`,`${R1_DIR}/boot.js`,`${R1_DIR}/visual.css`,R1_RELEASE];
export const R1_ENTRIES=['src/ui/rebalancing-app.js','src/runtime/rebalancing-worker.js','src/model/rebalancing-study.js'];
export const R1_MODULES=new Set([...R1_ENTRIES,'src/model/rebalancing-contract.js','src/model/rebalancing.js','src/model/rebalancing-verify.js','src/runtime/rebalancing-job.js','src/runtime/rebalancing-session.js','src/ui/rebalancing-view.js','src/ui/rebalancing-concept.js']);
export const R1_BOOT='import { startRebalancing } from "../../src/ui/rebalancing-app.js";\nstartRebalancing({ createWorker: () => new Worker(new URL("../../src/runtime/rebalancing-worker.js", import.meta.url), { type: "module" }) });\n';
import {hostedRoutePackage} from "./hosted-route-package.mjs";
export const R1_SOURCE_ASSETS=['rebalancing/index.html', 'rebalancing/visual.css', 'tools/pack.mjs', 'tools/hosted-route-package.mjs', 'tools/rebalancing-package.mjs', 'tools/software-delivery-package.mjs', 'tools/release-sidecar.mjs', 'tools/site-shell.mjs', 'tools/check-dist.mjs', 'tools/media.mjs', 'tools/comment-strip.mjs'];
const pack=hostedRoutePackage({name:'rebalancing',dir:R1_DIR,releasePath:R1_RELEASE,routeFiles:R1_FILES,entries:R1_ENTRIES,modules:R1_MODULES,sourceAssets:R1_SOURCE_ASSETS,schema:'fleetlab.rebalancing-release/1.0.0',scope:'R1_REBALANCING_ROUTE_CLOSURE_V1'});
export const createR1Sidecar=pack.create, r1PackageProblems=pack.problems;
