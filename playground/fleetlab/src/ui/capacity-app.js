// Entry for the NF-03 page: mounts the viewer with the committed study manifest and the system motion setting.
import {CAPACITY_STUDY} from '../data/depot-capacity-study.js';
import {createCapacityPage} from './depot-capacity-page.js';

export function startCapacity({doc=globalThis.document,manifest=CAPACITY_STUDY}={}){
  const motion=doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const page=createCapacityPage({manifest,reducedMotion:()=>Boolean(motion?.matches)});
  const changed=()=>page.motionChanged();
  motion?.addEventListener?.('change',changed);
  const destroy=page.destroy;
  page.destroy=()=>{motion?.removeEventListener?.('change',changed);destroy();};
  doc.getElementById('capacity-root').appendChild(page.element);
  doc.title='Scheduling or capacity? | FleetLab';
  return page;
}
