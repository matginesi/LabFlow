(function(){
'use strict';
const LF=window.LabFlow=window.LabFlow||{};
function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}
function key(id){id=String(id||'').trim();if(!id)throw new Error('Action id is required.');return id;}
function ensure(exp){if(!exp||typeof exp!=='object')throw new Error('ExperimentData is required.');exp.actionData=obj(exp.actionData);exp.actionData.proposals=obj(exp.actionData.proposals);exp.actionData.annotations=obj(exp.actionData.annotations);exp.actionData.status=obj(exp.actionData.status);return exp.actionData;}
function bucket(exp,kind,actionId,create){const root=ensure(exp),id=key(actionId);if(!Object.prototype.hasOwnProperty.call(root[kind],id)&&create)root[kind][id]={};return root[kind][id];}
function proposal(exp,actionId,targetId){const value=bucket(exp,'proposals',actionId,false);if(targetId==null||targetId==='')return value||null;return value&&typeof value==='object'?value[String(targetId)]||null:null;}
function setProposal(exp,actionId,targetId,value){const root=ensure(exp),id=key(actionId);if(targetId==null||targetId===''){root.proposals[id]=value;return value;}const map=bucket(exp,'proposals',id,true);map[String(targetId)]=value;return value;}
function removeProposal(exp,actionId,targetId){const root=ensure(exp),id=key(actionId);if(targetId==null||targetId===''){const had=Object.prototype.hasOwnProperty.call(root.proposals,id);delete root.proposals[id];return had;}const map=root.proposals[id];if(!map||typeof map!=='object')return false;const target=String(targetId),had=Object.prototype.hasOwnProperty.call(map,target);delete map[target];if(!Object.keys(map).length)delete root.proposals[id];return had;}
function proposals(exp,actionId){return bucket(exp,'proposals',actionId,false)||{};}
function annotation(exp,actionId){return bucket(exp,'annotations',actionId,false)||null;}
function setAnnotation(exp,actionId,value){const root=ensure(exp),id=key(actionId);root.annotations[id]=value;return value;}
function removeAnnotation(exp,actionId){const root=ensure(exp),id=key(actionId),had=Object.prototype.hasOwnProperty.call(root.annotations,id);delete root.annotations[id];return had;}
function status(exp,actionId,targetId){const value=bucket(exp,'status',actionId,false);if(targetId==null||targetId==='')return value||null;return value&&typeof value==='object'?value[String(targetId)]||null:null;}
function setStatus(exp,actionId,targetId,value){const root=ensure(exp),id=key(actionId);if(targetId==null||targetId===''){root.status[id]=value;return value;}const map=bucket(exp,'status',id,true);map[String(targetId)]=value;return value;}
function removeStatus(exp,actionId,targetId){const root=ensure(exp),id=key(actionId);if(targetId==null||targetId===''){const had=Object.prototype.hasOwnProperty.call(root.status,id);delete root.status[id];return had;}const map=root.status[id];if(!map||typeof map!=='object')return false;const target=String(targetId),had=Object.prototype.hasOwnProperty.call(map,target);delete map[target];if(!Object.keys(map).length)delete root.status[id];return had;}
function clear(exp,actionId){const id=key(actionId),root=ensure(exp);delete root.proposals[id];delete root.annotations[id];delete root.status[id];}
function snapshot(exp){const root=ensure(exp);return{proposals:root.proposals,annotations:root.annotations,status:root.status};}
function bounded(value,depth){
  depth=depth||0;if(value==null||typeof value==='number'||typeof value==='boolean')return value;
  if(typeof value==='string')return value.length>700?value.slice(0,700)+'…':value;
  if(depth>5)return'[bounded]';
  if(Array.isArray(value))return value.slice(0,8).map(function(item){return bounded(item,depth+1);});
  if(typeof value==='object'){const out={};Object.keys(value).slice(0,18).forEach(function(k){if(/^(curve|curves|points|rawText|requestMeta)$/i.test(k))return;out[k]=bounded(value[k],depth+1);});return out;}
  return String(value);
}
function assistantContext(exp,opts){
  opts=opts||{};const root=exp&&exp.actionData&&typeof exp.actionData==='object'?exp.actionData:{},limit=Math.max(1,Math.min(12,Number(opts.limit)||8)),items=[];
  ['proposals','annotations','status'].forEach(function(kind){const values=root[kind]&&typeof root[kind]==='object'?root[kind]:{};Object.keys(values).forEach(function(actionId){items.push({action_id:actionId,kind:kind.replace(/s$/,''),value:bounded(values[actionId],0)});});});
  return{items:items.slice(-limit),note:'Current persisted Action outputs. Proposals and annotations are not authoritative scientific data until an owning deterministic acceptance path applies them.'};
}
LF.ActionData={ensure:ensure,proposal:proposal,proposals:proposals,setProposal:setProposal,removeProposal:removeProposal,annotation:annotation,setAnnotation:setAnnotation,removeAnnotation:removeAnnotation,status:status,setStatus:setStatus,removeStatus:removeStatus,clear:clear,snapshot:snapshot,assistantContext:assistantContext};
}());
