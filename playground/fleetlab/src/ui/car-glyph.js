// A recognisable vehicle, drawn as vector geometry. Its color comes from the recorded activity.
const svg = (tag,attrs={}) => {
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,value] of Object.entries(attrs)) node.setAttribute(key,String(value));
  return node;
};
export function createCarGlyph(color='#3c8365') {
  const g=svg('g',{'aria-hidden':'true'});
  g.appendChild(svg('ellipse',{cx:0,cy:2,rx:17,ry:10,fill:'#18392c',opacity:.13}));
  for(const x of [-9,7]) for(const y of [-9,6]) g.appendChild(svg('rect',{x,y,width:5,height:4,rx:1.5,fill:'#263c35'}));
  g.appendChild(svg('rect',{x:-17,y:-8,width:34,height:16,rx:7,fill:color,stroke:'#254539','stroke-width':1}));
  g.appendChild(svg('rect',{x:-9,y:-6,width:17,height:12,rx:4,fill:'#f8fcf2'}));
  g.appendChild(svg('path',{d:'M 3 -5 L 8 -4 L 8 4 L 3 5 Z',fill:'#8fc5cf'}));
  g.appendChild(svg('path',{d:'M -8 -4 L -5 -5 L -5 5 L -8 4 Z',fill:'#94bbc4'}));
  g.appendChild(svg('rect',{x:-3,y:-3,width:5,height:6,rx:2,fill:'#d7e6de'}));
  g.appendChild(svg('circle',{cx:-.5,cy:0,r:1.8,fill:'#315c51'}));
  for(const y of [-5,3]) {
    g.appendChild(svg('rect',{x:13,y,width:3,height:2,rx:.8,fill:'#fff1ae'}));
    g.appendChild(svg('rect',{x:-16,y,width:2,height:2,rx:.5,fill:'#e5a39a'}));
  }
  return g;
}
