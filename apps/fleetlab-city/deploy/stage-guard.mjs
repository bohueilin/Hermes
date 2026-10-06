import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,dirname} from 'node:path';

export function releaseCommand(args){
  if(args.length===1&&args[0]==='--version')return 'version';
  if(JSON.stringify(args)===JSON.stringify(['pages','deployment','list','--project-name','fleetlab','--json']))return 'list';
  if(args.length===7&&args[0]==='pages'&&args[1]==='deploy'&&args[2]&&!args[2].startsWith('-')&&args[3]==='--project-name'&&args[4]==='fleetlab'&&args[5]==='--branch'&&['codex-city-explorer','feat/fleetlab-playground'].includes(args[6]))return 'deploy';
  throw Error('Unsupported release command. Only version, deployment list, or an explicit fleetlab stage/branch upload is permitted.');
}

export function verifyStage(site,commit,sourceRoot){
  site=resolve(site);
  const manifest=JSON.parse(readFileSync(resolve(dirname(site),'review/integration-manifest.json'),'utf8'));
  const files={};
  function walk(dir){
    if(!lstatSync(dir).isDirectory()||lstatSync(dir).isSymbolicLink())throw Error('Stage directory is not regular.');
    for(const name of readdirSync(dir)){
      const path=resolve(dir,name),stat=lstatSync(path);
      if(stat.isSymbolicLink())throw Error('Linked stage asset refused.');
      if(stat.isDirectory()){walk(path);continue;}
      if(!stat.isFile())throw Error('Special stage asset refused.');
      const rel=relative(site,path).split('\\').join('/'),data=readFileSync(path);
      files[rel]={bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
    }
  }
  walk(site);
  if(Object.keys(files).length!==Object.keys(manifest.files).length)throw Error('Stage inventory differs.');
  for(const [name,record] of Object.entries(files)){
    if(record.sha256!==manifest.files[name]?.sha256||record.bytes!==manifest.files[name]?.bytes)throw Error('Stage bytes differ from reviewed manifest.');
  }
  const selection=JSON.parse(readFileSync(resolve(site,'publication.json'),'utf8'));
  if(selection.source_commit!==commit)throw Error('Stage source commit differs from the clean checkout.');
  if(sourceRoot){
    for(const name of ['setup-codec.js','setup-sharing.js','studio.js']){
      const reviewed=readFileSync(resolve(sourceRoot,'playground/fleetlab/src/ui',name));
      if(files['src/ui/'+name]?.sha256!==createHash('sha256').update(reviewed).digest('hex'))throw Error('Stage is missing reviewed client fixes.');
    }
  }
  return Object.keys(files).length;
}
