import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSite,buildHtml} from '../tools/pack.mjs';
import {R1_RELEASE,r1PackageProblems} from '../tools/rebalancing-package.mjs';
import {measureSiteOwnership,lessonNavigation} from '../tools/software-delivery-package.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('R1 is explicitly owned, source-bound by a complete sidecar and excluded from offline',()=>{const files=buildSite(root);assert.ok(files.has(R1_RELEASE));assert.deepEqual(r1PackageProblems(files),[]);const counts=measureSiteOwnership(files);assert.ok(counts.r1_closure_bytes>0);assert.equal(counts.owners['src/model/rebalancing.js'],'rebalancing');assert.equal(buildHtml(root).includes('fleetlab.rebalancing-record'),false);const nav=lessonNavigation(files);assert.match(nav.get('network-flows/software-delivery/index.html'),/href="\/network-flows\/delivery-order\/"/);assert.match(nav.get('network-flows/delivery-order/index.html'),/href="\/network-flows\/rebalancing\/"/);});
test('R1 package rejects missing, changed or unowned route bytes',()=>{const files=buildSite(root);files.set('src/model/rebalancing.js',files.get('src/model/rebalancing.js')+'\n');assert.notDeepEqual(r1PackageProblems(files),[]);files.delete(R1_RELEASE);assert.notDeepEqual(r1PackageProblems(files),[]);});
import {copyProblems,checkSite} from '../tools/check-dist.mjs';
test('approved R1 forecast terminology is scoped and does not waive prediction or real-time claims',()=>{assert.deepEqual(copyProblems([{where:'src/model/rebalancing.js string',text:'forecast'}]),[]);assert.notDeepEqual(copyProblems([{where:'src/model/rebalancing.js string',text:'live forecast'}]),[]);assert.notDeepEqual(copyProblems([{where:'src/ui/unrelated.js string',text:'forecast'}]),[]);});

test('R1 research navigation is permitted only as the exact cited anchor, never a remote asset',()=>{const files=buildSite(root),labels=['unused-test-label'];assert.deepEqual(checkSite(files,{requiredLabels:labels}),[]);const path='network-flows/rebalancing/index.html',html=files.get(path);files.set(path,html.replace('<a href="https://arxiv.org/abs/2508.19933v3"','<img src="https://arxiv.org/abs/2508.19933v3"'));assert.ok(checkSite(files,{requiredLabels:labels}).some(p=>p.includes('external URL')));});
