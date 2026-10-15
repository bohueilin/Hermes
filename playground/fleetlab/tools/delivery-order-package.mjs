// Declared owner of the bounded companion. Existing modules keep their physical owner.
export const ORDER_DIR='network-flows/delivery-order';
export const ORDER_RELEASE=`${ORDER_DIR}/release.json`;
export const ORDER_FILES=[`${ORDER_DIR}/index.html`,`${ORDER_DIR}/boot.js`,`${ORDER_DIR}/visual.css`,ORDER_RELEASE];
export const ORDER_ENTRIES=['src/ui/delivery-order-app.js','src/runtime/delivery-order-worker.js','src/data/delivery-order-study.js'];
export const ORDER_MODULES=new Set([...ORDER_ENTRIES,
 'src/model/delivery-order-contract.js','src/model/delivery-order.js','src/model/delivery-order-verify.js',
 'src/model/delivery-order-search.js','src/model/delivery-order-study-verify.js','src/runtime/delivery-order-job.js',
 'src/ui/delivery-order-page.js','src/ui/delivery-order-view.js','src/ui/delivery-order-player.js']);
export const ORDER_BOOT='import { startDeliveryOrder } from "../../src/ui/delivery-order-app.js";\nimport { ORDER_STUDY } from "../../src/data/delivery-order-study.js";\nstartDeliveryOrder({ manifest: ORDER_STUDY, createWorker: () => new Worker(new URL("../../src/runtime/delivery-order-worker.js", import.meta.url), { type: "module" }) });\n';

import {hostedRoutePackage} from './hosted-route-package.mjs';
export const ORDER_SOURCE_ASSETS=['delivery-order/index.html', 'delivery-order/visual.css', 'tools/pack.mjs', 'tools/hosted-route-package.mjs', 'tools/delivery-order-package.mjs', 'tools/software-delivery-package.mjs', 'tools/release-sidecar.mjs', 'tools/site-shell.mjs', 'tools/check-dist.mjs', 'tools/media.mjs', 'tools/comment-strip.mjs'];
const pack=hostedRoutePackage({name:'delivery-order',dir:ORDER_DIR,releasePath:ORDER_RELEASE,routeFiles:ORDER_FILES,entries:ORDER_ENTRIES,modules:ORDER_MODULES,sourceAssets:ORDER_SOURCE_ASSETS,schema:'fleetlab.delivery-order-release/1.0.0',scope:'DELIVERY_ORDER_ROUTE_CLOSURE_V1'});
export const createOrderSidecar=pack.create,orderPackageProblems=pack.problems;
