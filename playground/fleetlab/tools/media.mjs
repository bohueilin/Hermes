// Build-time media allowlist. Binary bytes never pass through text decoding.
export const APP_MAX_BYTES = 2.5*1024*1024;
export const MEDIA_MODULE = 'src/ui/hero-media.js';
export const MEDIA_LIMITS = new Map([['media/fleet-film.mp4',4*1024*1024],['media/fleet-film-poster.webp',200*1024]]);

export function mediaProblems(path,data) {
  const limit=MEDIA_LIMITS.get(path);
  if(!limit)return [`media: unexpected ${path}`];
  if(!Buffer.isBuffer(data))return [`media: ${path} must contain binary bytes`];
  if(data.length>limit)return [`media size: ${path} exceeds ${limit} byte limit`];
  const invalid=()=>[`media format: invalid ${path}`];
  if(path.endsWith('.webp')){
    if(data.length<20||data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WEBP'||data.readUInt32LE(4)+8!==data.length)return invalid();
    let at=12, image=false;
    while(at+8<=data.length){const type=data.toString('ascii',at,at+4),size=data.readUInt32LE(at+4);if(['VP8 ','VP8L'].includes(type))image=true;at+=8+size+(size%2);if(at>data.length)return invalid();}
    return image&&at===data.length?[]:invalid();
  }
  let ftyp=false,moov=false,mdat=false,avc=false,audio=false,video=false;
  function boxes(start,end){let at=start;while(at+8<=end){const size=data.readUInt32BE(at),type=data.toString('ascii',at+4,at+8);if(size<8||at+size>end)throw new Error('box bounds');
    if(type==='ftyp'){ftyp=true;if(size<16||!['isom','iso2','mp41','mp42','avc1'].includes(data.toString('ascii',at+8,at+12)))throw new Error('brand');}
    if(type==='moov')moov=true;if(type==='mdat')mdat=true;
    if(type==='hdlr'){if(size<20)throw new Error('handler');const handler=data.toString('ascii',at+16,at+20);audio ||=handler==='soun';video ||=handler==='vide';}
    if(type==='stsd'){if(size<24)throw new Error('sample');avc ||=data.toString('ascii',at+20,at+24)==='avc1';}
    if(['moov','trak','mdia','minf','stbl'].includes(type))boxes(at+8,at+size);
    at+=size;
  }if(at!==end)throw new Error('trailing bytes');}
  try{boxes(0,data.length);}catch{return invalid();}
  return ftyp&&moov&&mdat&&avc&&video&&!audio?[]:invalid();
}
