import {ORDER_CHAPTERS} from './delivery-order-view.js';
export function createOrderPlayer({onChange=()=>{}}={}){
 let state={time_ms:0,chapter:0,vehicle:'V1',playing:false,ended:false},elapsed=0,restricted=false,visible=true;
 const emit=()=>onChange({...state});
 const chapter=i=>{if(!Number.isInteger(i)||!ORDER_CHAPTERS[i]&&i!==0)return;state={...state,time_ms:ORDER_CHAPTERS[i],chapter:i,playing:false,ended:false};elapsed=0;emit();};
 const start=()=>{state.playing=!restricted&&visible;state.ended=false;emit();};
 const replay=()=>{chapter(0);start();};
 return {state:()=>({...state}),chapter,watch:replay,replay,resume(){if(state.ended)replay();else{state.time_ms=ORDER_CHAPTERS[state.chapter];start();}},pause(){state.playing=false;emit();},
  inspect(t,vehicle=state.vehicle){if(!Number.isFinite(t))return;state={...state,time_ms:Math.min(2400000,Math.max(0,Math.floor(t/1000)*1000)),vehicle,playing:false,ended:false};emit();},
  preference(value){restricted=Boolean(value);state.playing=false;emit();},visible(value){visible=Boolean(value);if(!visible)state.playing=false;emit();},historyRestore(){state.playing=false;emit();},
  advance(dt){if(!state.playing||restricted||!visible||!Number.isFinite(dt)||dt<=0)return;elapsed+=dt;const prior=state.chapter;
   while(state.playing&&elapsed>=(state.chapter===0?5000:7000)){elapsed-=state.chapter===0?5000:7000;if(state.chapter===5){state.playing=false;state.ended=true;elapsed=0;}else{state.chapter++;state.time_ms=ORDER_CHAPTERS[state.chapter];}}
   if(prior!==state.chapter||state.ended)emit();},
 };
}
