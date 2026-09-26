// Hash routes work in the hosted bundle and the single-file offline package.
export const ROUTES=Object.freeze({
  overview:{path:'overview',title:'Overview'},
  simulation:{path:'fleet-day',title:'Fleet day'},
  streets:{path:'street-lab',title:'Street lab'},
  depots:{path:'experiments',title:'Four-area workbench'},
  catalog:{path:'catalog',title:'Learning catalog'},
  approach:{path:'approach',title:'Product approach'},
  operations:{path:'regional',title:'Four-area workspace'},
  tour:{path:'walkthrough',title:'Guided walkthrough'},
});
const MAX_ROUTE_LENGTH=33000;

export function parseRoute(hash=''){
  if(hash===''||hash==='#') return {page:'overview'};
  if(typeof hash!=='string'||hash.length>MAX_ROUTE_LENGTH)throw Error('This link is too large. Open a view link or use an exported setup.');
  const match=/^#\/([a-z-]+)(?:\?(.+))?$/.exec(hash);
  if(!match)throw Error('This FleetLab link has an invalid address.');
  const page=Object.keys(ROUTES).find(key=>ROUTES[key].path===match[1]);
  if(!page)throw Error('This FleetLab view is not available.');
  const route={page};
  if(match[2]){
    // URLSearchParams tolerates malformed percent sequences; a setup link must not.
    decodeURIComponent(match[2]);
    for(const [key,value] of new URLSearchParams(match[2])){
      if(!['lesson','setup'].includes(key)||key in route||!value)throw Error('This link contains an unsupported or repeated setting.');
      if(key==='lesson'&&!/^[A-Za-z0-9_-]{1,100}$/.test(value))throw Error('This lesson identifier is invalid.');
      if(key==='setup'&&(!/^[A-Za-z0-9_-]+$/.test(value)||value.length>32768))throw Error('This shared setup is malformed or too large.');
      route[key]=value;
    }
    if(route.lesson&&route.setup)throw Error('A link must contain one lesson or one shared setup.');
  }
  return route;
}

export function routeHref({page,lesson,setup}){
  if(!ROUTES[page])throw RangeError('Unknown studio page');
  const params=new URLSearchParams();
  if(lesson!==undefined)params.set('lesson',lesson);
  if(setup!==undefined)params.set('setup',setup);
  const href=`#/${ROUTES[page].path}${params.size?'?'+params.toString():''}`;
  parseRoute(href);
  return href;
}

export function followLink(event,visit){
  if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||(event.button!==undefined&&event.button!==0))return;
  event.preventDefault();visit();
}
