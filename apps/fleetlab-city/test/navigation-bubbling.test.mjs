import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Exercise the actual registration statement and browser-style parent bubbling.
// Bootstrapping maps/network is unrelated to which elements receive listeners.
const source=readFileSync(new URL('../web/app.mjs',import.meta.url),'utf8');
const registration=source.split('\n').find(line=>line.startsWith('for (const button of document.querySelectorAll('));
function harness(){
 const node=(tag,view,parent)=>({tag,dataset:view?{view}:{},parent,listeners:[],addEventListener(type,handler){if(type==='click')this.listeners.push(handler);}});
 const body=node('body','replay');
 const nav=node('button','compare',body);
 const play=node('button',null,body);
 const control=node('input',null,body);
 const state={playing:false,time:15,shows:[]};
 const show=view=>{state.shows.push(view);body.dataset.view=view;state.playing=false;};
 const nodes=[body,nav,play,control];
 const document={querySelectorAll:selector=>nodes.filter(n=>Object.hasOwn(n.dataset,'view')&&(!selector.startsWith('button')||n.tag==='button'))};
 new Function('document','show',registration)(document,show);
 play.addEventListener('click',()=>{state.playing=!state.playing;});
 const click=target=>{for(let current=target;current;current=current.parent)for(const listener of current.listeners)listener({target,currentTarget:current});};
 return {body,nav,play,control,state,click};
}

test('Play and ordinary controls bubble without triggering navigation or pausing replay',()=>{
 const h=harness();
 h.click(h.play);
 assert.equal(h.state.playing,true,'Play must remain running after its click bubbles');
 h.click(h.control);
 assert.equal(h.state.playing,true,'ordinary control clicks must not pause replay');
 assert.deepEqual(h.state.shows,[]);
 assert.equal(h.body.listeners.length,0,'body data-view is state, not a navigation control');
});

test('navigation click switches views and pauses replay exactly once',()=>{
 const h=harness();h.state.playing=true;
 h.click(h.nav);
 assert.deepEqual(h.state.shows,['compare']);
 assert.equal(h.state.playing,false);
 assert.equal(h.body.dataset.view,'compare');
});
