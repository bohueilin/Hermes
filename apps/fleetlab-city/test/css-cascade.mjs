// Static cascade for the disabled-state parity test (a test helper; no product module imports it).
// It parses the real stylesheets in page order (following @import), matches selectors against a DOM (the Playground
// fake DOM), applies !important, specificity and order, resolves var(), and composites colour and opacity over the real
// ancestor surfaces. Anything it does not model throws, so an unsupported selector, at-rule or colour fails loudly.

// ---------- stylesheet parsing ----------
const blank=t=>t.replace(/\/\*[\s\S]*?\*\//g,'');
function close(text,open){let depth=1,i=open+1,quote=null;for(;i<text.length&&depth;i++){const c=text[i];if(quote){if(c==='\\')i++;else if(c===quote)quote=null;}else if(c==='"'||c==="'")quote=c;else if(c==='{')depth++;else if(c==='}')depth--;}return i;}
export function splitTop(text,sep){const out=[];let depth=0,quote=null,start=0;for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c==='\\')i++;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'")quote=c;else if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;else if(c===sep&&!depth){out.push(text.slice(start,i));start=i+1;}}out.push(text.slice(start));return out.map(s=>s.trim()).filter(Boolean);}
function declarations(body){return splitTop(body,';').map(d=>{const c=d.indexOf(':');if(c<0)throw Error(`declaration without a colon: ${d}`);let value=d.slice(c+1).trim();const important=/!\s*important$/i.test(value);if(important)value=value.replace(/\s*!\s*important$/i,'');return {prop:d.slice(0,c).trim().toLowerCase(),value,important};});}
// load(href) returns {name, text}; rules come out in cascade order, imports first.
export function loadSheets(entries,load){
 const rules=[];let order=0;
 const sheet=(name,text)=>{
  text=blank(text);
  for(const m of text.matchAll(/@import\s+url\(\s*["']?([^"')]+)["']?\s*\)\s*;/g)){const next=load(m[1]);sheet(next.name,next.text);}
  text=text.replace(/@import\s+url\([^)]*\)\s*;/g,'');
  const walk=(t,ctx)=>{let i=0;for(;;){const open=t.indexOf('{',i);if(open<0){if(t.slice(i).trim())throw Error(`${name}: trailing text ${t.slice(i).trim().slice(0,40)}`);return;}const end=close(t,open);const prelude=t.slice(i,open).trim(),body=t.slice(open+1,end-1);
   if(prelude.startsWith('@media'))walk(body,[...ctx,prelude.slice(6).trim()]);
   else if(/^@(-webkit-)?keyframes|^@font-face|^@page/.test(prelude)){}
   else if(prelude.startsWith('@'))throw Error(`${name}: unmodelled at-rule ${prelude}`);
   else rules.push({sheet:name,selectors:splitTop(prelude,',').map(s=>({text:s,ast:parseComplex(s)})),decls:declarations(body),media:ctx,order:order++});
   i=end;}};
  walk(text,[]);
 };
 for(const e of entries)sheet(e.name,e.text);
 return rules;
}

// ---------- media ----------
export function mediaMatches(list,env){return list.every(q=>splitTop(q,',').some(one=>one.split(/\s+and\s+/i).every(part=>{
 part=part.trim();if(/^(screen|all)$/i.test(part))return true;if(/^print$/i.test(part))return false;
 const m=part.match(/^\(\s*([a-z-]+)\s*:\s*([^)]+?)\s*\)$/i);if(!m)throw Error(`unmodelled media query ${part}`);const [,f,v]=m;
 if(f==='max-width')return env.width<=parseFloat(v);if(f==='min-width')return env.width>=parseFloat(v);
 if(f==='hover')return env.hover===v;if(f==='pointer')return env.pointer===v;
 if(f==='prefers-reduced-motion')return env.reducedMotion===v;if(f==='forced-colors')return (env.forcedColors?'active':'none')===v;
 if(f==='prefers-color-scheme')return (env.scheme??'light')===v;if(f==='prefers-reduced-data')return (env.reducedData?'reduce':'no-preference')===v;
 throw Error(`unmodelled media feature ${f}`);
})));}

// ---------- selectors ----------
export function parseComplex(text){
 const parts=[];let i=0,comb=' ';const s=text.trim();
 while(i<s.length){
  const ws=s.slice(i).match(/^\s*([>+~])?\s*/);if(i>0&&ws[0].length)comb=ws[1]||' ';i+=ws[0].length;if(i>=s.length)break;
  const c={tag:null,id:null,classes:[],attrs:[],pseudos:[],element:null,comb};comb=' ';
  let any=false;
  for(;;){const rest=s.slice(i);let m;
   if((m=rest.match(/^(\*|[a-zA-Z][\w-]*)/))&&!any){c.tag=m[1].toLowerCase();i+=m[0].length;any=true;continue;}
   if((m=rest.match(/^#([\w-]+)/))){c.id=m[1];i+=m[0].length;any=true;continue;}
   if((m=rest.match(/^\.((?:[\w-]|\\.)+)/))){c.classes.push(m[1].replace(/\\(.)/g,'$1'));i+=m[0].length;any=true;continue;}
   if((m=rest.match(/^\[\s*([\w-]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*)?(i)?\]/))){c.attrs.push({name:m[1],op:m[2]||null,value:m[3]??m[4]??m[5]??null});i+=m[0].length;any=true;continue;}
   if((m=rest.match(/^::?(-?[\w-]+)/))){const name=m[1].toLowerCase();i+=m[0].length;any=true;
    if(m[0].startsWith('::')||['before','after','first-line','first-letter'].includes(name)){c.element=name;if(s[i]==='(')i=closeParen(s,i);continue;}
    if(s[i]==='('){const end=closeParen(s,i),arg=s.slice(i+1,end-1);i=end;
     if(['not','is','where','matches'].includes(name))c.pseudos.push({name,list:splitTop(arg,',').map(parseComplex)});
     else if(name==='has')c.pseudos.push({name,list:splitTop(arg,',').map(a=>parseComplex(/^[>+~]/.test(a.trim())?':scope'+a:':scope '+a))});
     else if(['nth-child','nth-of-type','nth-last-child'].includes(name))c.pseudos.push({name,nth:parseNth(arg)});
     else throw Error(`unmodelled functional pseudo-class :${name}()`);}
    else c.pseudos.push({name});continue;}
   break;}
  if(!any)throw Error(`cannot parse selector ${text} at ${s.slice(i)}`);
  parts.push(c);
 }
 return parts;
}
function closeParen(s,open){let depth=0;for(let i=open;i<s.length;i++){if(s[i]==='(')depth++;else if(s[i]===')'&&--depth===0)return i+1;}throw Error(`unclosed ( in ${s}`);}
function parseNth(arg){arg=arg.trim().toLowerCase();if(arg==='odd')return [2,1];if(arg==='even')return [2,0];const m=arg.match(/^([+-]?\d*)?n\s*([+-]\s*\d+)?$/);if(m){const a=m[1]===''||m[1]===undefined||m[1]==='+'?1:m[1]==='-'?-1:Number(m[1]);return [a,m[2]?Number(m[2].replace(/\s/g,'')):0];}if(/^[+-]?\d+$/.test(arg))return [0,Number(arg)];throw Error(`unmodelled nth ${arg}`);}
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const max=list=>list.reduce((m,s)=>cmp(s,m)>0?s:m,[0,0,0]);
export const cmp=(a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2];
// Selectors-4 specificity: :is(), :not() and :has() take their most specific argument; :where() counts 0.
export function specificity(parts){let s=[0,0,0];for(const c of parts){if(c.id)s=add(s,[1,0,0]);s=add(s,[0,c.classes.length+c.attrs.length,0]);if(c.tag&&c.tag!=='*')s=add(s,[0,0,1]);if(c.element)s=add(s,[0,0,1]);
 for(const p of c.pseudos){if(p.name==='where'||p.name==='scope')continue;if(p.list)s=add(s,max(p.list.map(specificity)));else s=add(s,[0,1,0]);}}return s;}

const FORM=new Set(['button','input','select','textarea','optgroup','option','fieldset']);
function isDisabled(e){if(!FORM.has(e.localName))return false;if(e.hasAttribute('disabled'))return true;for(let a=e.parentElement;a;a=a.parentElement)if(a.localName==='fieldset'&&a.hasAttribute('disabled'))return true;return false;}
const siblings=e=>e.parentElement?e.parentElement.children:[e];
// st holds the element under the pointer (hover), the pressed one (active) and the focused one (focus).
function matchCompound(e,c,st,scope){
 if(c.tag&&c.tag!=='*'&&e.localName!==c.tag)return false;
 if(c.id&&e.getAttribute('id')!==c.id)return false;
 for(const k of c.classes)if(!(e.getAttribute('class')||'').split(/\s+/).includes(k))return false;
 for(const a of c.attrs){const v=e.getAttribute(a.name);if(v===null)return false;if(a.op==='='&&v!==a.value)return false;if(a.op==='^='&&!v.startsWith(a.value))return false;if(a.op==='$='&&!v.endsWith(a.value))return false;if(a.op==='*='&&!v.includes(a.value))return false;if(a.op==='~='&&!v.split(/\s+/).includes(a.value))return false;if(a.op==='|='&&!(v===a.value||v.startsWith(a.value+'-')))return false;}
 for(const p of c.pseudos){const n=p.name;
  if(n==='not'){if(p.list.some(x=>matchComplex(e,x,st,scope)))return false;continue;}
  if(n==='is'||n==='where'||n==='matches'){if(!p.list.some(x=>matchComplex(e,x,st,scope)))return false;continue;}
  if(n==='has'){if(!p.list.some(x=>descendantsAndSiblings(e).some(d=>matchComplex(d,x,st,e))))return false;continue;}
  if(n==='scope'){if(e!==scope)return false;continue;}
  if(n==='root'){if(e.parentElement)return false;continue;}
  if(n==='disabled'){if(!isDisabled(e))return false;continue;}
  if(n==='enabled'){if(!FORM.has(e.localName)||isDisabled(e))return false;continue;}
  if(n==='checked'){if(!e.hasAttribute('checked')&&!e.checked)return false;continue;}
  if(n==='hover'||n==='active'){let hit=false;for(let a=st[n];a;a=a.parentElement)if(a===e)hit=true;if(!hit)return false;continue;}
  if(n==='focus'||n==='focus-visible'){if(st.focus!==e)return false;continue;}
  if(n==='focus-within'){if(!st.focus||!e.contains(st.focus))return false;continue;}
  if(n==='empty'){if(e.childNodes.some(k=>k.nodeType===1||(k.nodeType===3&&k.data!=='')))return false;continue;}
  if(n==='first-child'){if(siblings(e)[0]!==e)return false;continue;}
  if(n==='last-child'){const s=siblings(e);if(s[s.length-1]!==e)return false;continue;}
  if(n==='only-child'){if(siblings(e).length!==1)return false;continue;}
  if(n==='first-of-type'){if(siblings(e).find(x=>x.localName===e.localName)!==e)return false;continue;}
  if(n==='last-of-type'){const s=siblings(e).filter(x=>x.localName===e.localName);if(s[s.length-1]!==e)return false;continue;}
  if(n==='nth-child'||n==='nth-of-type'||n==='nth-last-child'){let s=siblings(e);if(n==='nth-of-type')s=s.filter(x=>x.localName===e.localName);if(n==='nth-last-child')s=[...s].reverse();const idx=s.indexOf(e)+1,[a,b]=p.nth;if(a===0?idx!==b:((idx-b)/a<0||(idx-b)%a!==0))return false;continue;}
  if(n==='link'||n==='any-link'){if(!(e.localName==='a'&&e.hasAttribute('href')))return false;continue;}
  // A static page has no visited link, target, invalid field or placeholder showing; the remaining states always match.
  if(['visited','target','invalid','indeterminate','placeholder-shown'].includes(n))return false;
  if(['valid','required','optional','read-only','read-write','default'].includes(n))continue;
  throw Error(`unmodelled pseudo-class :${n}`);}
 return true;}
function descendantsAndSiblings(e){const out=[];const walk=n=>{for(const k of n.children){out.push(k);walk(k);}};walk(e);if(e.parentElement)for(const s of e.parentElement.children)if(s!==e)out.push(s);return out;}
export function matchComplex(e,parts,st,scope=null){
 const go=(node,i)=>{const c=parts[i];if(!matchCompound(node,c,st,scope))return false;if(i===0)return true;
  if(c.comb==='>')return node.parentElement?go(node.parentElement,i-1):false;
  if(c.comb===' '){for(let a=node.parentElement;a;a=a.parentElement)if(go(a,i-1))return true;return false;}
  const sib=siblings(node),idx=sib.indexOf(node);
  if(c.comb==='+')return idx>0&&go(sib[idx-1],i-1);
  if(c.comb==='~'){for(let j=idx-1;j>=0;j--)if(go(sib[j],i-1))return true;return false;}
  throw Error('bad combinator '+c.comb);};
 return go(e,parts.length-1);}

// ---------- cascade ----------
const SHORTHAND={'background-color':['background','background-color'],'border-color':['border','border-color'],'outline-style':['outline','outline-style'],'background-image':['background','background-image']};
const INHERITED=new Set(['color','cursor']);
const INITIAL={'background-color':'transparent','border-color':'currentcolor','color':'#000000','opacity':'1','transform':'none','cursor':'auto','background-image':'none','outline-style':'none'};
// The winning declaration for prop (expanded from its shorthands), or null.
function winning(rules,e,prop,env,st){
 let best=null;const longs=SHORTHAND[prop]??[prop];
 for(const r of rules){if(!mediaMatches(r.media,env))continue;
  let spec=null;for(const s of r.selectors){if(s.ast.some(c=>c.element))continue;if(matchComplex(e,s.ast,st)){const sp=specificity(s.ast);if(!spec||cmp(sp,spec)>0)spec=sp;}}
  if(!spec)continue;
  r.decls.forEach((d,k)=>{if(!longs.includes(d.prop))return;const value=expand(d.prop,prop,d.value);
   const cand={value,important:d.important,spec,order:r.order*1000+k};
   if(!best||(cand.important!==best.important?cand.important:cmp(cand.spec,best.spec)>0||(cmp(cand.spec,best.spec)===0&&cand.order>best.order)))best=cand;});}
 return best;}
const NAMED={white:'#ffffff',black:'#000000',transparent:'#00000000',red:'#ff0000',buttontext:'#000000',canvas:'#ffffff',canvastext:'#000000'};
const isColourToken=t=>/^#[0-9a-f]{3,8}$/i.test(t)||/^(rgba?|hsla?|var)\(/i.test(t)||Object.hasOwn(NAMED,t.toLowerCase())||/^currentcolor$/i.test(t);
function expand(from,to,value){if(from===to)return value;
 const tokens=splitTop(value.replace(/\s+/g,' '),' '),colour=tokens.find(isColourToken);
 if(to==='background-color')return colour??'transparent';
 if(to==='border-color')return colour??'currentcolor';
 if(to==='background-image')return tokens.find(t=>/gradient\(|url\(/i.test(t))??'none';
 if(to==='outline-style')return tokens.find(t=>/^(none|solid|dashed|dotted|double|auto|groove|ridge|inset|outset)$/i.test(t))??'none';
 throw Error(`unmodelled shorthand ${from} for ${to}`);}
export function computed(rules,e,prop,env,st){
 const value=winning(rules,e,prop,env,st)?.value;
 if(value===undefined||value==='inherit'||(value==='unset'&&INHERITED.has(prop))){if(value===undefined&&!INHERITED.has(prop))return INITIAL[prop];return e.parentElement?computed(rules,e.parentElement,prop,env,st):INITIAL[prop];}
 if(value==='initial'||value==='unset')return INITIAL[prop];
 return resolveVars(rules,e,value,env,st);}
function customProperty(rules,e,name,env,st){for(let a=e;a;a=a.parentElement){const w=winning(rules,a,name,env,st);if(w)return resolveVars(rules,a,w.value,env,st);}return null;}
function resolveVars(rules,e,value,env,st,depth=0){
 if(depth>20)throw Error('var() cycle');
 return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g,(_,name,fallback)=>{const v=customProperty(rules,e,name,env,st);if(v!==null)return resolveVars(rules,e,v,env,st,depth+1);if(fallback!==undefined)return resolveVars(rules,e,fallback.trim(),env,st,depth+1);throw Error(`unresolved ${name}`);});}

// ---------- colour ----------
export function rgba(text){
 const t=text.trim().toLowerCase();if(Object.hasOwn(NAMED,t))return rgba(NAMED[t]);
 let m=t.match(/^#([0-9a-f]{3,8})$/);if(m){let h=m[1];if(h.length<=4)h=[...h].map(c=>c+c).join('');return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:h.length===8?parseInt(h.slice(6,8),16)/255:1};}
 m=t.match(/^rgba?\(([^)]*)\)$/);if(m){const p=m[1].split(/[\s,/]+/).filter(Boolean),ch=x=>x.endsWith('%')?parseFloat(x)*2.55:parseFloat(x);return {r:ch(p[0]),g:ch(p[1]),b:ch(p[2]),a:p[3]===undefined?1:p[3].endsWith('%')?parseFloat(p[3])/100:parseFloat(p[3])};}
 throw Error(`unmodelled colour ${text}`);}
const over=(src,dst)=>{const a=src.a+dst.a*(1-src.a);if(a===0)return {r:0,g:0,b:0,a:0};const mix=k=>(src[k]*src.a+dst[k]*dst.a*(1-src.a))/a;return {r:mix('r'),g:mix('g'),b:mix('b'),a};};
function luminance({r,g,b}){const ch=c=>{c/=255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;};return 0.2126*ch(r)+0.7152*ch(g)+0.0722*ch(b);}
const contrast=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+0.05)/(lo+0.05);};

// The colour a text pixel and a background pixel of element e end up with on the page: each ancestor's background is
// painted in its own opacity group, the canvas is white, and a background image anywhere on the chain fails closed.
export function paint(rules,e,env,st,{allowOwnImage=false}={}){
 const chain=[];for(let a=e;a;a=a.parentElement)chain.unshift(a);
 const colour=(n,prop)=>{let v=computed(rules,n,prop,env,st);if(/^currentcolor$/i.test(v))v=computed(rules,n,'color',env,st);return rgba(v);};
 for(const n of chain){const img=computed(rules,n,'background-image',env,st);if(img!=='none'&&!(allowOwnImage&&n===e))throw Error(`background image on ${n.localName}${n.id?'#'+n.id:''}: ${img}`);}
 const group=(i,kind)=>{const n=chain[i];let buf=over(colour(n,'background-color'),{r:0,g:0,b:0,a:0});
  if(i===chain.length-1){if(kind==='text')buf=over(colour(n,'color'),buf);}
  else{const child=group(i+1,kind);child.a*=Number(computed(rules,chain[i+1],'opacity',env,st));buf=over(child,buf);}return buf;};
 const top=kind=>{const g=group(0,kind);g.a*=Number(computed(rules,chain[0],'opacity',env,st));return over(g,{r:255,g:255,b:255,a:1});};
 const text=top('text'),background=top('bg');
 const opacity=chain.reduce((p,n)=>p*Number(computed(rules,n,'opacity',env,st)),1);
 return {text,background,ratio:contrast(text,background),opacity};}

// ---------- a small HTML builder for the static lesson pages (the fake DOM has no innerHTML) ----------
const VOID=new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr']);
const decode=t=>t.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ');
export function buildDocument(document,html){
 const root=document.documentElement;
 let stack=[root];const top=()=>stack[stack.length-1];
 const re=/<!--[\s\S]*?-->|<!doctype[^>]*>|<(script|style)\b([^>]*)>[\s\S]*?<\/\1>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+/gi;
 for(const m of html.matchAll(re)){
  const [tok,raw,,end,tag,attrs]=m;
  if(tok.startsWith('<!')||raw)continue;
  if(end){const name=end.toLowerCase();if(name==='html')continue;const at=stack.map(n=>n.localName).lastIndexOf(name);if(at>0)stack=stack.slice(0,at);continue;}
  if(tag){const name=tag.toLowerCase();if(name==='html'){for(const a of (attrs||'').matchAll(/\s([\w:-]+)\s*=\s*"([^"]*)"/g))root.setAttribute(a[1],a[2]);continue;}
   const n=name==='head'?document.head:name==='body'?document.body:document.createElement(name);
   for(const a of (attrs||'').matchAll(/\s([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g))n.setAttribute(a[1],decode(a[2]??a[3]??a[4]??''));
   if(n.parentNode!==top())top().appendChild(n);if(!VOID.has(name)&&!/\/\s*$/.test(attrs||''))stack.push(n);continue;}
  if(tok.trim()||top().localName!=='html')top().appendChild(document.createTextNode(decode(tok)));
 }
 return document;}
