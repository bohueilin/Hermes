import test from 'node:test';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../tools/pack.mjs';
import {measureSiteOwnership} from '../tools/software-delivery-package.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
test('delivery-order owner counts full closure without transferring existing legacy bytes',async()=>{
 const spec=await import('../tools/delivery-order-package.mjs').catch(()=>({}));
 assert.ok(spec.ORDER_MODULES instanceof Set,'new route owner is explicitly declared');
 const files=buildSite(root);for(const path of [...spec.ORDER_FILES,...spec.ORDER_MODULES])files.delete(path);const before=measureSiteOwnership(files);
 for(const path of spec.ORDER_ENTRIES)files.set(path,'export const example = 1;');
 for(const path of spec.ORDER_FILES)files.set(path,'example');
 const after=measureSiteOwnership(files);
 assert.equal(after.legacy_text_bytes,before.legacy_text_bytes);
 assert.equal(after.nf04_closure_bytes,before.nf04_closure_bytes);
 assert.ok(after.delivery_order_closure_bytes>=after.delivery_order_route_local_bytes);
 files.set('src/model/unowned-new-thing.js','export const unowned = true;');
 assert.throws(()=>measureSiteOwnership(files),/unknown.*ownership/);
});
test('new sidecar has its exact scope and rejects altered captured payload',async()=>{
 const {orderPackageProblems,ORDER_RELEASE}=await import('../tools/delivery-order-package.mjs');const files=buildSite(root);
 assert.equal(JSON.parse(files.get(ORDER_RELEASE)).emitted_scope,'DELIVERY_ORDER_ROUTE_CLOSURE_V1');assert.deepEqual(orderPackageProblems(files),[]);
 files.set('src/model/delivery-order.js',files.get('src/model/delivery-order.js')+'\nchanged');assert.ok(orderPackageProblems(files).length);
});
