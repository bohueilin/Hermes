// Warm-colour scanner behind colour-lock.test.mjs. `node test/colour-scan.mjs` prints the current
// snapshot in the format of fixtures/warm-colour-baseline.json.
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {maskSource} from '../../../playground/fleetlab/tools/pack.mjs';

const repository=fileURLToPath(new URL('../../../',import.meta.url));
const NAMED=Object.assign(Object.create(null),{aliceblue:'f0f8ff',antiquewhite:'faebd7',aqua:'00ffff',aquamarine:'7fffd4',azure:'f0ffff',beige:'f5f5dc',bisque:'ffe4c4',black:'000000',blanchedalmond:'ffebcd',blue:'0000ff',blueviolet:'8a2be2',brown:'a52a2a',burlywood:'deb887',cadetblue:'5f9ea0',chartreuse:'7fff00',chocolate:'d2691e',coral:'ff7f50',cornflowerblue:'6495ed',cornsilk:'fff8dc',crimson:'dc143c',cyan:'00ffff',darkblue:'00008b',darkcyan:'008b8b',darkgoldenrod:'b8860b',darkgray:'a9a9a9',darkgreen:'006400',darkgrey:'a9a9a9',darkkhaki:'bdb76b',darkmagenta:'8b008b',darkolivegreen:'556b2f',darkorange:'ff8c00',darkorchid:'9932cc',darkred:'8b0000',darksalmon:'e9967a',darkseagreen:'8fbc8f',darkslateblue:'483d8b',darkslategray:'2f4f4f',darkslategrey:'2f4f4f',darkturquoise:'00ced1',darkviolet:'9400d3',deeppink:'ff1493',deepskyblue:'00bfff',dimgray:'696969',dimgrey:'696969',dodgerblue:'1e90ff',firebrick:'b22222',floralwhite:'fffaf0',forestgreen:'228b22',fuchsia:'ff00ff',gainsboro:'dcdcdc',ghostwhite:'f8f8ff',gold:'ffd700',goldenrod:'daa520',gray:'808080',green:'008000',greenyellow:'adff2f',grey:'808080',honeydew:'f0fff0',hotpink:'ff69b4',indianred:'cd5c5c',indigo:'4b0082',ivory:'fffff0',khaki:'f0e68c',lavender:'e6e6fa',lavenderblush:'fff0f5',lawngreen:'7cfc00',lemonchiffon:'fffacd',lightblue:'add8e6',lightcoral:'f08080',lightcyan:'e0ffff',lightgoldenrodyellow:'fafad2',lightgray:'d3d3d3',lightgreen:'90ee90',lightgrey:'d3d3d3',lightpink:'ffb6c1',lightsalmon:'ffa07a',lightseagreen:'20b2aa',lightskyblue:'87cefa',lightslategray:'778899',lightslategrey:'778899',lightsteelblue:'b0c4de',lightyellow:'ffffe0',lime:'00ff00',limegreen:'32cd32',linen:'faf0e6',magenta:'ff00ff',maroon:'800000',mediumaquamarine:'66cdaa',mediumblue:'0000cd',mediumorchid:'ba55d3',mediumpurple:'9370db',mediumseagreen:'3cb371',mediumslateblue:'7b68ee',mediumspringgreen:'00fa9a',mediumturquoise:'48d1cc',mediumvioletred:'c71585',midnightblue:'191970',mintcream:'f5fffa',mistyrose:'ffe4e1',moccasin:'ffe4b5',navajowhite:'ffdead',navy:'000080',oldlace:'fdf5e6',olive:'808000',olivedrab:'6b8e23',orange:'ffa500',orangered:'ff4500',orchid:'da70d6',palegoldenrod:'eee8aa',palegreen:'98fb98',paleturquoise:'afeeee',palevioletred:'db7093',papayawhip:'ffefd5',peachpuff:'ffdab9',peru:'cd853f',pink:'ffc0cb',plum:'dda0dd',powderblue:'b0e0e6',purple:'800080',rebeccapurple:'663399',red:'ff0000',rosybrown:'bc8f8f',royalblue:'4169e1',saddlebrown:'8b4513',salmon:'fa8072',sandybrown:'f4a460',seagreen:'2e8b57',seashell:'fff5ee',sienna:'a0522d',silver:'c0c0c0',skyblue:'87ceeb',slateblue:'6a5acd',slategray:'708090',slategrey:'708090',snow:'fffafa',springgreen:'00ff7f',steelblue:'4682b4',tan:'d2b48c',teal:'008080',thistle:'d8bfd8',tomato:'ff6347',turquoise:'40e0d0',violet:'ee82ee',wheat:'f5deb3',white:'ffffff',whitesmoke:'f5f5f5',yellow:'ffff00',yellowgreen:'9acd32'});
const NAMED_WORD=new RegExp(`(?<![\\w#.-])(?:${Object.keys(NAMED).join('|')})(?![\\w(-])`,'gi');
// Every colour function is found; only rgb() and hsl() with numeric arguments can be classified.
const FUNCTION=/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|color)\(/gi;
// %23 is a URL-encoded '#', as in an inline SVG data URI.
const HEX=/(?:(?<![\w&])#|%23)(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;
const VAR=/var\(\s*(--[\w-]+)/g;
// In script text a colour name counts only in a literal that reads as a CSS value (every word a number, colour,
// function, custom property or CSS keyword) or after a paint property, never in prose.
const CSS_WORD=/^(?:[+-]?(?:\d+\.?\d*|\.\d+)(?:%|[a-z]+)?|#[0-9a-f]{3,8}|--[\w-]+|!important|none|hidden|solid|dashed|dotted|double|groove|ridge|inset|outset|thin|medium|thick|transparent|currentcolor|inherit|initial|unset|revert|auto|to|at|top|right|bottom|left|center|circle|ellipse)$/i;
const cssValue=text=>text.replace(/[\w-]+\(/g,' ').split(/[\s,/()]+/).every(word=>!word||CSS_WORD.test(word)||NAMED[word.toLowerCase()]);
const SCRIPT_PAINT=/(?:^|[\s;{"'])(?:fill|stroke|(?:[a-z]+-)*color|background(?:-image)?|border(?:-[a-z]+)*|outline|column-rule|box-shadow|text-shadow)\s*[:=]\s*["']?([^;"'}]*)/gi;
const PAINT_ATTRIBUTES=new Set(['fill','stroke','stop-color','flood-color','lighting-color','color']);
// A tag runs to the first '>' outside quotes, and an attribute value may be unquoted.
const TAG_BODY=`(?:[^>"']|"[^"]*"|'[^']*')*`,ATTRIBUTE=/\s([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

export function colour(literal){
 const text=literal.toLowerCase();let r,g,b,alpha=1;
 if(text[0]==='#'||NAMED[text]){
  let hex=text[0]==='#'?text.slice(1):NAMED[text];if(hex.length<5)hex=[...hex].map(c=>c+c).join('');
  [r,g,b]=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));if(hex.length===8)alpha=parseInt(hex.slice(6),16)/255;
 }else{
  const call=/^(rgba?|hsla?)\(([^()]*)\)$/.exec(text),args=call?call[2].trim().split(/\s*[,/]\s*|\s+/):[];
  if(args.length<3||args.length>4||!args.every(a=>/^[+-]?(\d+\.?\d*|\.\d+)(%|deg)?$/.test(a)))throw new Error(`unclassified colour ${literal}`);
  const n=args.map(parseFloat);if(args[3])alpha=args[3].endsWith('%')?n[3]/100:n[3];
  if(call[1].startsWith('hsl'))return {hue:(n[0]%360+360)%360,chroma:(1-Math.abs(2*n[2]/100-1))*n[1]/100,alpha};
  [r,g,b]=args.slice(0,3).map((a,i)=>a.endsWith('%')?n[i]*2.55:n[i]);
 }
 const max=Math.max(r,g,b),c=max-Math.min(r,g,b);
 const hue=!c?0:max===r?60*(((g-b)/c+6)%6):max===g?60*((b-r)/c+2):60*((r-g)/c+4);
 return {hue,chroma:c/255,alpha};
}
export function isWarm(literal){const {hue,chroma,alpha}=colour(literal);return alpha>0&&chroma>=0.06&&hue>=12&&hue<60;}

// mode is 'css', 'script' or 'attribute' (markup other than style and paint): that gets hex and functions only.
function colours(text,mode){
 const found=[];
 for(const m of text.matchAll(FUNCTION)){
  let end=m.index+m[0].length,depth=1;
  for(;end<text.length&&depth;end++)depth+=text[end]==='('?1:text[end]===')'?-1:0;
  found.push([text.slice(m.index,end),m.index]);
 }
 for(const m of text.matchAll(HEX))found.push([m[0].replace(/^%23/,'#'),m.index]);
 if(mode==='css'||mode==='script'&&cssValue(text))for(const m of text.matchAll(NAMED_WORD))found.push([m[0],m.index]);
 else if(mode==='script')for(const p of text.matchAll(SCRIPT_PAINT))for(const m of p[1].matchAll(NAMED_WORD))found.push([m[0],p.index+p[0].length-p[1].length+m.index]);
 return found;
}
function closing(text,open){
 let depth=0,quote='';
 for(let i=open;i<text.length;i++){
  const c=text[i];
  if(quote){if(c==='\\')i++;else if(c===quote)quote='';}
  else if(c==='"'||c==="'")quote=c;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return i;
 }
 return text.length;
}
function declarations(text,base,each){
 let start=0,depth=0,quote='';
 for(let i=0;i<=text.length;i++){
  const c=text[i];
  if(quote&&i<text.length){if(c==='\\')i++;else if(c===quote)quote='';continue;}
  if(c==='"'||c==="'")quote=c;else if(c==='(')depth++;else if(c===')')depth--;
  else if(i===text.length||(c===';'&&depth<=0)){
   const d=text.slice(start,i),colon=d.indexOf(':');
   if(colon>0)each(d.slice(0,colon).trim(),d.slice(colon+1),base+start+colon+1);
   start=i+1;
  }
 }
}
// Comments must already be blanked. Keys carry the at-rule chain, the selector list and the property.
function rules(text,base,chain,each){
 for(let i=0;;){
  const open=text.indexOf('{',i);if(open<0)return;
  const close=closing(text,open),body=text.slice(open+1,close);
  // Whitespace around commas and combinators is dropped, so a reformat keeps the key.
  const prelude=text.slice(i,open).split(';').at(-1).trim().replace(/\s+/g,' ').replace(/\s*([,>+~])\s*/g,'$1');
  if(prelude.startsWith('@')&&body.includes('{'))rules(body,base+open+1,[...chain,prelude],each);
  else if(body.includes('{'))throw new Error(`nested rule under ${prelude} is not scanned`);
  else declarations(body,base+open+1,(property,value,offset)=>each([...chain,prelude,property],value,offset));
  i=close+1;
 }
}
const blankComments=text=>text.replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' '));

export function scanSources(files){
 const literals=[],uses=[],warmTokens=new Set();
 for(const [file,src] of files){
  const starts=[0];for(let i=src.indexOf('\n');i>=0;i=src.indexOf('\n',i+1))starts.push(i+1);
  const at=offset=>{let line=starts.length-1;while(starts[line]>offset)line--;return `${file}:${line+1}:${offset-starts[line]+1}`;};
  const found=(parts,value,offset,mode='css')=>{
   for(const [literal,i] of colours(value,mode)){
    const where=at(offset+i);let warm;
    try{warm=isWarm(literal);}catch(error){throw new Error(`${error.message} at ${where}`);}
    literals.push({key:[file,...parts,literal.toLowerCase()].join(' | '),at:where,warm});
    if(warm&&parts.at(-1)?.startsWith('--'))warmTokens.add(parts.at(-1));
   }
   for(const m of value.matchAll(VAR))uses.push({token:m[1],key:[file,...parts,`var(${m[1]})`].join(' | '),at:at(offset+m.index)});
   if(mode==='script'&&/^--[\w-]+$/.test(value))uses.push({token:value,key:[file,...parts,value].join(' | '),at:at(offset)});
  };
  const css=(text,base,prefix)=>rules(blankComments(text),base,prefix,(parts,value,offset)=>found(parts,value,offset));
  // Returns the code with its literals blanked, so an inline handler's code can still be searched.
  const script=(text,base,parts=[])=>{const ranges=[],code=maskSource(text,{literals:ranges});for(const [a,b] of ranges)found(parts,text.slice(a,b),base+a,'script');return code;};
  if(file.endsWith('.css'))css(src,0,[]);
  else if(/\.m?js$/.test(file))script(src,0);
  else{
   const markup=src.replace(new RegExp(`(<(style|script)\\b${TAG_BODY}>)([\\s\\S]*?)(?=<\\/\\2\\s*>)`,'gi'),(m,open,tag,body,offset)=>{
    if(tag.toLowerCase()==='style')css(body,offset+open.length,['<style>']);else script(body,offset+open.length);
    return open+' '.repeat(body.length);
   });
   for(const tag of markup.matchAll(new RegExp(`<([a-z][\\w:-]*)(\\s${TAG_BODY})>`,'gi')))for(const a of tag[2].matchAll(ATTRIBUTE)){
    const name=a[1].toLowerCase(),value=a[2]??a[3]??a[4],parts=[`<${tag[1]}>`,name];
    const offset=tag.index+1+tag[1].length+a.index+a[0].length-value.length-(a[4]===undefined?1:0);
    if(name==='style')declarations(value,offset,(property,v,o)=>found([`<${tag[1]} style>`,property],v,o));
    else if(name.startsWith('on'))found(parts,script(value,offset,parts),offset,'attribute');
    else found(parts,value,offset,PAINT_ATTRIBUTES.has(name)?'css':'attribute');
   }
  }
 }
 return {literals,tokens:uses.filter(u=>warmTokens.has(u.token))};
}

// The shipped network-flows stylesheets, pages and scripts; the City viewer (web/) ships from the frozen City base.
export function readSources(){
 const files=new Map(),skip=new Set(['playground/fleetlab/test','playground/fleetlab/tools','playground/fleetlab/media']);
 const walk=dir=>{for(const entry of readdirSync(repository+dir,{withFileTypes:true})){
  const path=dir+entry.name;
  if(entry.isDirectory()){if(!skip.has(path))walk(path+'/');}
  else if(/\.(css|html|m?js)$/.test(entry.name))files.set(path,readFileSync(repository+path,'utf8'));
 }};
 walk('playground/fleetlab/');walk('apps/fleetlab-city/hosted/');
 return new Map([...files].sort(([a],[b])=>a<b?-1:1));
}

const count=records=>{const counts={};for(const {key} of records)counts[key]=(counts[key]??0)+1;return counts;};
export const snapshot=scan=>({literals:count(scan.literals.filter(h=>h.warm)),tokens:count(scan.tokens)});
const sorted=counts=>Object.fromEntries(Object.entries(counts).sort(([a],[b])=>a<b?-1:1));
export const format=s=>JSON.stringify({literals:sorted(s.literals),tokens:sorted(s.tokens)},null,1)+'\n';

if(process.argv[1]===fileURLToPath(import.meta.url))process.stdout.write(format(snapshot(scanSources(readSources()))));
