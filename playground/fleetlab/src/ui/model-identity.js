import {el} from './dom.js';
export const NON_AFFILIATION='Independent teaching project. Not affiliated with or endorsed by any operator or vehicle maker named here.';
export function modelHeader(name,geography,version){
 const element=el('p',{class:'model-identity'});
 function update(value,stale=false,place=geography){element.textContent=`${name} · ${place} · ${value}${stale?' (stale: previous settings)':''}. Results are not interchangeable with other FleetLab models.`;}
 update(version);return {element,update};
}
