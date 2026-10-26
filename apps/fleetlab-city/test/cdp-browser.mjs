import {spawn} from 'node:child_process';
import {accessSync,constants,mkdtempSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// Dependency-free DevTools-protocol client over Node's built-in WebSocket, for test-side browser checks.
// Chrome runs headless with a throwaway profile, and every host name except 127.0.0.1 fails to resolve.
// Without the three backgrounding flags, a second headless window reports itself hidden and stops rendering.
export const MAC_CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FLAGS=['--headless','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking',
 '--disable-component-update','--disable-sync','--disable-extensions','--disable-default-apps','--mute-audio','--use-mock-keychain',
 '--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling',
 '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1'];
const executable=path=>{try{accessSync(path,constants.X_OK);return statSync(path).isFile();}catch{return false;}};
// Node emits no 'exit' when a signal ends the process, so these clean up too and then re-raise the signal.
const SIGNALS=['SIGINT','SIGTERM','SIGHUP'];

// FLEETLAB_CHROME, else the macOS default. Absent Chrome fails under CI=true or FLEETLAB_REQUIRE_CHROME=1 and skips otherwise.
export function chromePolicy(env=process.env){
 const path=env.FLEETLAB_CHROME||MAC_CHROME,found=executable(path),required=env.CI==='true'||env.FLEETLAB_REQUIRE_CHROME==='1';
 return {path,found,required,skip:found||required?false:`Chrome not found at ${path}; set FLEETLAB_CHROME to run this check`};
}

function connect(url){
 const ws=new WebSocket(url),pending=new Map(),listeners=new Set();let seq=0;
 ws.onmessage=({data})=>{
  const m=JSON.parse(data);
  if(m.id===undefined){for(const fn of listeners)fn(m);return;}
  const p=pending.get(m.id);if(!p)return;pending.delete(m.id);
  m.error?p.reject(Error(`${p.method}: ${m.error.message}`)):p.resolve(m.result);
 };
 ws.onclose=()=>{for(const p of pending.values())p.reject(Error(`${p.method}: DevTools connection closed`));pending.clear();};
 const on=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
 const send=(method,params={},sessionId,ms=15000)=>new Promise((resolve,reject)=>{
  const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error(`${method}: no reply in ${ms} ms`));},ms);
  pending.set(id,{method,resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
  try{ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));}catch(error){pending.get(id).reject(error);pending.delete(id);}
 });
 const wait=(method,sessionId,ms=15000)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{off();reject(Error(`${method}: not received in ${ms} ms`));},ms);
  const off=on(m=>{if(m.method===method&&m.sessionId===sessionId){clearTimeout(timer);off();resolve(m.params);}});
 });
 return new Promise((resolve,reject)=>{ws.onopen=()=>resolve({ws,send,on,wait});ws.onerror=()=>reject(Error('DevTools WebSocket failed to open'));});
}

function endpoint(child,ms){
 return new Promise((resolve,reject)=>{
  let stderr='';
  const fail=message=>{clearTimeout(timer);reject(Error(`${message}; stderr: ${stderr.slice(-400)}`));};
  const timer=setTimeout(()=>fail(`no DevTools endpoint in ${ms} ms`),ms);
  child.on('error',error=>fail(error.message));
  child.on('exit',code=>fail(`Chrome exited with ${code}`));
  child.stderr.on('data',data=>{stderr=(stderr+data).slice(-8192);const m=stderr.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});
 });
}

export async function launchChrome(path,{timeout=20000}={}){
 if(!executable(path))throw Error(`Chrome is required but not found at ${path}; install it or set FLEETLAB_CHROME`);
 const profile=mkdtempSync(join(tmpdir(),'fleetlab-chrome-'));
 const child=spawn(path,[...FLAGS,'--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
 const exited=new Promise(resolve=>{child.once('exit',resolve);child.once('error',resolve);});
 // A crashed or interrupted test process must not leave Chrome or its profile behind. The handlers stay subscribed
 // while the profile is removed, so a second signal (the test runner's own, say) cannot end the process half way; the
 // signal is then re-raised for its default action unless another handler of the process is left to act on it.
 const abandon=()=>{child.kill('SIGKILL');rmSync(profile,{recursive:true,force:true,maxRetries:3});};
 const release=()=>{process.off('exit',abandon);for(const signal of SIGNALS)process.off(signal,interrupted);};
 const interrupted=signal=>{try{abandon();}finally{release();if(!process.listenerCount(signal))process.kill(process.pid,signal);}};
 process.once('exit',abandon);for(const signal of SIGNALS)process.on(signal,interrupted);
 let cdp;
 const close=async()=>{
  release();
  if(cdp){await cdp.send('Browser.close',{},undefined,5000).catch(()=>{});cdp.ws.close();}
  let timer;
  await Promise.race([exited,new Promise(resolve=>{timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},5000);})]);
  clearTimeout(timer);await exited;
  rmSync(profile,{recursive:true,force:true,maxRetries:3});
 };
 try{
  cdp=await connect(await endpoint(child,timeout));
  const version=await cdp.send('Browser.getVersion');
  return {version,send:cdp.send,newPage:()=>newPage(cdp),close};
 }catch(error){await close();throw Error(`Chrome at ${path} did not launch: ${error.message}`);}
}

async function newPage({send,on,wait}){
 const {targetId}=await send('Target.createTarget',{url:'about:blank',newWindow:true});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const call=(method,params)=>send(method,params,sessionId),sessions=new Set([sessionId]);
 await call('Page.enable');await call('Runtime.enable');await call('Log.enable');
 return {
  sessionId,send:call,
  // Events of this page and of the targets attached through attachChildren, each with its own sessionId.
  on:fn=>on(m=>{if(sessions.has(m.sessionId))fn(m);}),
  // Auto-attaches the targets this page starts, such as dedicated workers. Each starts paused until setup has run with a
  // send bound to its session, so its first events are not missed: a dedicated worker's script response and its own
  // requests are reported on the worker's session only.
  async attachChildren(setup){
   on(({method,params,sessionId:parent})=>{
    if(method!=='Target.attachedToTarget'||!sessions.has(parent))return;
    const child=params.sessionId,run=(method,params)=>send(method,params,child);sessions.add(child);
    Promise.resolve().then(()=>setup(run)).catch(()=>{}).finally(()=>run('Runtime.runIfWaitingForDebugger').catch(()=>{}));
   });
   await call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
  },
  async navigate(url,ms=15000){
   const loaded=wait('Page.loadEventFired',sessionId,ms);
   const {errorText}=await call('Page.navigate',{url});
   if(errorText){loaded.catch(()=>{});throw Error(`${url}: ${errorText}`);}
   await loaded;
  },
  async evaluate(expression){
   const {result,exceptionDetails}=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
   if(exceptionDetails)throw Error(exceptionDetails.exception?.description??exceptionDetails.text);
   return result.value;
  },
  // Device-metrics emulation sets the exact layout width (a headless window clamps at 500 px); scrollbars are hidden.
  async emulate({width,height,mobile=false,deviceScaleFactor=1}){
   await call('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor});
   await call('Emulation.setScrollbarsHidden',{hidden:true});
  },
  close:()=>send('Target.closeTarget',{targetId})
 };
}
