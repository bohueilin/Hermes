import {el} from './dom.js';
export const NON_AFFILIATION='Synthetic operations; map qualification remains open. Not affiliated with or endorsed by Waymo, Zoox, or their partners. No operational authority.';
export function modelHeader(name,geography,version){
 const element=el('p',{class:'model-identity'});
 function update(value,stale=false,place=geography){element.textContent=`${name} · ${place} · ${value}${stale?' (stale: previous settings)':''}. Results are not interchangeable with other FleetLab models.`;}
 update(version);return {element,update};
}
