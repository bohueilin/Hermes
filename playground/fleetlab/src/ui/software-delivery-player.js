// Presentation time only. Never allocates work or changes an accepted model record.
export function createDeliveryPlayer({chapters=[],endpoint_ms,H_ms,quantum_ms=1000,vehicle='V1',arm='repeated',onChange=()=>{}}){
 let state={time_ms:0,vehicle,arm,chapter:0,mode:'guide',playing:false,ended:false},hold=0,elapsed=0,visible=true,restricted=false;
 const emit=()=>onChange({...state,active:state.playing&&visible&&!restricted});
 const snap=t=>Math.max(0,Math.min(H_ms,Math.floor(t/quantum_ms)*quantum_ms));
 const authored=()=>{const c=chapters[state.chapter];if(c){state.time_ms=c.t_ms;state.vehicle=c.vehicle;}};
 const start=()=>{state.playing=!restricted;state.ended=false;emit();};
 return {
  state:()=>({...state,active:state.playing&&visible&&!restricted}),
  watch(){state.mode=chapters.length?'guide':'inspection';state.chapter=0;hold=0;authored();if(chapters.length)start();else emit();},
  pause(){state.playing=false;emit();},
  resume(){if(!chapters.length)return;state.mode='guide';authored();start();},
  replay(){state.chapter=0;hold=0;state.mode='guide';authored();if(chapters.length)start();else emit();},
  chapter(index){if(!Number.isInteger(index)||!chapters[index])return;state.chapter=index;hold=0;state.mode='guide';state.playing=false;state.ended=false;authored();emit();},
  inspect(t,selected=state.vehicle){state.time_ms=snap(t);state.vehicle=selected;state.mode='inspection';state.playing=false;state.ended=false;elapsed=0;emit();},
  setArm(next){if(!['repeated','cold'].includes(next))return;state.arm=next;emit();},
  visible(value){visible=Boolean(value);emit();},
  preference(value){restricted=Boolean(value);if(restricted)state.playing=false;emit();},
  historyRestore(){state.playing=false;emit();},
  timelinePlay(){state.mode='timeline';elapsed=state.time_ms;if(state.time_ms>=endpoint_ms){state.time_ms=0;elapsed=0;}start();},
  timelineReplay(){state.time_ms=0;elapsed=0;state.mode='timeline';start();},
  advance(dt){
   if(!state.playing||!visible||restricted||!Number.isFinite(dt)||dt<=0)return;
   if(state.mode==='guide'){
    hold+=dt;
    while(state.playing&&chapters[state.chapter]&&hold>=chapters[state.chapter].hold_ms){
     hold-=chapters[state.chapter].hold_ms;
     if(state.chapter===chapters.length-1){state.playing=false;state.ended=true;hold=0;}
     else{state.chapter++;authored();}
    }
   }else if(state.mode==='timeline'){
    elapsed=Math.min(endpoint_ms,elapsed+dt*30);state.time_ms=snap(elapsed);
    if(elapsed>=endpoint_ms){state.time_ms=endpoint_ms;state.playing=false;state.ended=true;}
   }
   emit();
  },
 };
}
