import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {el,setAttr,svgElement} from '../src/ui/dom.js';
import {hostedNode} from '../../../apps/fleetlab-city/hosted/integration.mjs';
import {node as visitorNode} from '../../../apps/fleetlab-city/hosted/visitor.mjs';

// Every value passed today is a constant or a route, so these refusals guard future data-fed attributes.
const UNSAFE_URLS=['javascript:alert(1)','JavaScript:alert(1)',' javascript:alert(1)','java\tscript:alert(1)','\u0001javascript:x','data:text/html,<b>x</b>','DATA:image/svg+xml,<svg/>'];
const SAFE_URLS=['#/fleet-day','/city-explorer/','./visual.css','https://example.org/a','blob:https://example.org/1'];
const URL_NAMES=['href','src','xlink:href'];

test('one attribute setter refuses inline handlers and script-capable URLs',()=>{
  const restore=installFakeDom();try{
    for(const name of ['onclick','ONLOAD','onmouseover']){
      assert.throws(()=>setAttr(document.createElement('a'),name,'x'),/inline event attribute/);
      assert.throws(()=>el('a',{[name]:'x'}),/inline event attribute/);
      assert.throws(()=>svgElement('rect',{[name]:'x'}),/inline event attribute/);
    }
    for(const name of URL_NAMES)for(const url of UNSAFE_URLS){
      assert.throws(()=>el('a',{[name]:url}),/unsafe .* URL/,`${name}=${JSON.stringify(url)}`);
      assert.throws(()=>svgElement('a',{[name]:url}),/unsafe .* URL/);
    }
    for(const url of SAFE_URLS)assert.equal(el('a',{href:url}).getAttribute('href'),url);
    const json='data:application/json;charset=utf-8,'+encodeURIComponent('{"a":1}'),poster='data:image/webp;base64,UklGRg==';
    assert.equal(el('a',{download:'setup.json',href:json}).getAttribute('href'),json);
    assert.equal(el('img',{src:poster,alt:''}).getAttribute('src'),poster);
    assert.equal(el('p',{title:'javascript: is only text here'}).getAttribute('title'),'javascript: is only text here');
    assert.equal(svgElement('rect',{width:3}).getAttribute('width'),'3');
  }finally{restore();}
});

test('hosted page builders refuse inline handlers and script-capable URLs',()=>{
  const restore=installFakeDom();try{
    for(const node of [hostedNode,visitorNode]){
      assert.throws(()=>node(document,'a',{onclick:'x'}),/unsafe attribute onclick/);
      for(const url of UNSAFE_URLS)assert.throws(()=>node(document,'a',{href:url}),/unsafe attribute href/);
      for(const url of SAFE_URLS)assert.equal(node(document,'a',{href:url},'Link').getAttribute('href'),url);
    }
  }finally{restore();}
});

test('page builders set computed attribute names only through a guarded setter',()=>{
  const found=[];
  for(const folder of [new URL('../src/ui/',import.meta.url),new URL('../../../apps/fleetlab-city/hosted/',import.meta.url)]){
    for(const name of readdirSync(folder).filter(f=>/\.m?js$/.test(f))){
      const count=(readFileSync(new URL(name,folder),'utf8').match(/\.setAttribute\(\s*[^'"`\s]/g)??[]).length;
      if(count)found.push(`${name}:${count}`);
    }
  }
  assert.deepEqual(found,['dom.js:1','integration.mjs:1','visitor.mjs:1']);
});
