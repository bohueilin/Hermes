// Strict bounded JSON input and RFC 8785 canonical text on the depot lab's restricted domain (contract C1.1).
// Size is checked on exact UTF-8 bytes before any parsing; duplicate keys are refused before an ordinary
// parser could erase them. Canonical text reuses core/canon.js after asserting the restricted domain.
import {canonicalJson} from '../../core/canon.js';
export const MAX_INPUT_BYTES=524288,MAX_DEPTH=32,MAX_STRING=16384,MAX_ARRAY=4096;
const FORBIDDEN=new Set(['__proto__','constructor','prototype']);
export function utf8Length(text){
 let n=0;
 for(let i=0;i<text.length;i++){
  const c=text.charCodeAt(i);
  if(c<0x80)n+=1;else if(c<0x800)n+=2;
  else if(c>=0xd800&&c<=0xdbff&&i+1<text.length&&(text.charCodeAt(i+1)&0xfc00)===0xdc00){n+=4;i++;}
  else n+=3;
 }
 return n;
}
export const hasLoneSurrogate=s=>/[\ud800-\udbff](?![\udc00-\udfff])|(?:^|[^\ud800-\udbff])[\udc00-\udfff]/.test(s);
class ParseIssue extends Error{constructor(code,at,detail=''){super(`${code} at ${at}${detail?`: ${detail}`:''}`);this.code=code;this.at=at;}}
export function parseStrict(text,{maxBytes=MAX_INPUT_BYTES,maxDepth=MAX_DEPTH}={}){
 if(typeof text!=='string')return {ok:false,issues:[{code:'INPUT_NOT_TEXT',path:'',value:typeof text,bound:'string'}]};
 const bytes=utf8Length(text);
 if(bytes>maxBytes)return {ok:false,issues:[{code:'INCOMPLETE_RESOURCE_LIMIT',path:'',value:bytes,bound:maxBytes}]};
 let i=0;const n=text.length;
 const ws=()=>{while(i<n){const c=text[i];if(c===' '||c==='\t'||c==='\n'||c==='\r')i++;else break;}};
 const string=()=>{
  i++;let out='';
  for(;;){
   if(i>=n)throw new ParseIssue('UNTERMINATED_STRING',i);
   const c=text.charCodeAt(i);
   if(c===0x22){i++;break;}
   if(c<0x20)throw new ParseIssue('CONTROL_CHARACTER',i);
   if(c===0x5c){
    const e=text[i+1];
    if(e==='u'){const h=text.slice(i+2,i+6);if(!/^[0-9a-fA-F]{4}$/.test(h))throw new ParseIssue('BAD_ESCAPE',i);out+=String.fromCharCode(parseInt(h,16));i+=6;}
    else{const m={'"':'"','\\':'\\','/':'/',b:'\b',f:'\f',n:'\n',r:'\r',t:'\t'}[e];if(m===undefined)throw new ParseIssue('BAD_ESCAPE',i);out+=m;i+=2;}
   }else{out+=text[i];i++;}
   if(out.length>MAX_STRING)throw new ParseIssue('STRING_LIMIT',i);
  }
  if(hasLoneSurrogate(out))throw new ParseIssue('LONE_SURROGATE',i);
  return out;
 };
 const number=()=>{
  const m=/^-?(?:0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(text.slice(i,i+400));
  if(!m)throw new ParseIssue('BAD_TOKEN',i);
  if(m[1]||m[2])throw new ParseIssue('NON_INTEGER_NUMBER',i,m[0]);
  if(m[0]==='-0')throw new ParseIssue('NEGATIVE_ZERO',i);
  const v=Number(m[0]);if(!Number.isSafeInteger(v)||String(v)!==m[0])throw new ParseIssue('UNSAFE_INTEGER',i,m[0]);
  i+=m[0].length;return v;
 };
 const value=depth=>{
  ws();const c=text[i];
  // Depth counts nested containers only: 32 nested arrays/objects are admitted whatever their innermost member.
  if((c==='{'||c==='[')&&depth>maxDepth)throw new ParseIssue('NESTING_LIMIT',i);
  if(c==='{'){
   i++;const obj={},seen=new Set();ws();
   if(text[i]==='}'){i++;return obj;}
   for(;;){
    ws();if(text[i]!=='"')throw new ParseIssue('BAD_TOKEN',i);
    const key=string();
    if(seen.has(key))throw new ParseIssue('DUPLICATE_KEY',i,key);
    if(FORBIDDEN.has(key))throw new ParseIssue('FORBIDDEN_KEY',i,key);
    seen.add(key);ws();if(text[i]!==':')throw new ParseIssue('BAD_TOKEN',i);i++;
    obj[key]=value(depth+1);ws();
    if(text[i]===','){i++;continue;}
    if(text[i]==='}'){i++;return obj;}
    throw new ParseIssue('BAD_TOKEN',i);
   }
  }
  if(c==='['){
   i++;const arr=[];ws();
   if(text[i]===']'){i++;return arr;}
   for(;;){
    arr.push(value(depth+1));if(arr.length>MAX_ARRAY)throw new ParseIssue('ARRAY_LIMIT',i);ws();
    if(text[i]===','){i++;continue;}
    if(text[i]===']'){i++;return arr;}
    throw new ParseIssue('BAD_TOKEN',i);
   }
  }
  if(c==='"')return string();
  if(c==='-'||(c>='0'&&c<='9'))return number();
  for(const [word,v]of [['true',true],['false',false],['null',null]])if(text.startsWith(word,i)){i+=word.length;return v;}
  throw new ParseIssue(i>=n?'UNEXPECTED_END':'BAD_TOKEN',i);
 };
 try{
  const v=value(1);ws();if(i!==n)throw new ParseIssue('TRAILING_CONTENT',i);
  return {ok:true,value:v,bytes,issues:[]};
 }catch(error){
  if(!(error instanceof ParseIssue))throw error;
  return {ok:false,issues:[{code:error.code,path:`@${error.at}`,value:null,bound:null}]};
 }
}
// Restricted JCS domain: null, booleans, safe integers (no -0), strings without lone surrogates, arrays without
// holes and plain objects. Inside that domain core/canon.js sorts keys by UTF-16 code units exactly as RFC 8785.
function assertDomain(v,path,depth){
 if(depth>64)throw new TypeError(`canonical value too deep at ${path}`);
 if(v===null||typeof v==='boolean')return;
 if(typeof v==='number'){if(!Number.isSafeInteger(v)||Object.is(v,-0))throw new TypeError(`canonical number at ${path}`);return;}
 if(typeof v==='string'){if(hasLoneSurrogate(v))throw new TypeError(`lone surrogate at ${path}`);return;}
 if(Array.isArray(v)){for(let k=0;k<v.length;k++){if(!(k in v))throw new TypeError(`array hole at ${path}`);assertDomain(v[k],`${path}[${k}]`,depth+1);}return;}
 const proto=v&&typeof v==='object'?Object.getPrototypeOf(v):undefined;
 if(proto!==Object.prototype&&proto!==null)throw new TypeError(`unsupported canonical value at ${path}`);
 for(const k of Object.keys(v)){if(hasLoneSurrogate(k))throw new TypeError(`lone surrogate key at ${path}`);assertDomain(v[k],`${path}.${k}`,depth+1);}
}
export function jcs(value){assertDomain(value,'$',0);return canonicalJson(value);}
const encoder=new TextEncoder();
export const canonicalBytes=value=>encoder.encode(jcs(value));
export const deepFreeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const k of Object.keys(v))deepFreeze(v[k]);}return v;};
export const clone=v=>JSON.parse(jcs(v));
