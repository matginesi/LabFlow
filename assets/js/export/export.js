/*
 * Build deterministic LabFlow export artifacts from validated current state.
 * Boundary: Export is a projection and never an editable scientific model.
 */
(function () {
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  if(!LF.Core||!LF.DomainSchema)throw new Error('export.js requires LabFlow.Core and LabFlow.DomainSchema.');
  const C=LF.Core;
  function sourceArchive(exp){return exp&&exp.raw&&exp.raw.sourceArchive;}
  function hasSource(exp){return sourceArchive(exp) instanceof ArrayBuffer&&sourceArchive(exp).byteLength>0;}
  function snapshot(exp){return LF.DomainSchema.snapshot(exp,{includeSourceArchive:false});}
  function manifest(exp){return{format:'labflow-save',generatedAt:new Date().toISOString(),experimentId:exp.id||'',name:exp.meta&&exp.meta.name||'',source:{name:exp.meta&&exp.meta.sourceName||'',sha256:exp.raw&&exp.raw.sha256||'',immutable:true,included:hasSource(exp)},revision:Number(exp.sync&&exp.sync.revision||0),patches:(exp.patches||[]).length};}
  async function sha256Hex(bytes){if(!bytes||!globalThis.crypto||!crypto.subtle||!crypto.subtle.digest)return'';const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');}
  function canonicalSnapshot(exp){if(!LF.CanonicalStore)throw new Error('LabFlow.CanonicalStore is required for canonical export snapshots.');const store=LF.CanonicalStore.ensure(exp);const copy=JSON.parse(JSON.stringify(store)),ms=copy.records&&copy.records.measurements||[];ms.forEach(function(m){delete m.curve;delete m.curves;delete m.points;});return copy;}
  async function saveZip(exp){if(!window.JSZip)throw new Error('JSZip is unavailable.');
const zip=new JSZip(),data=snapshot(exp),marker=manifest(exp);
    if(hasSource(exp)){const digest=String(exp.raw&&exp.raw.sha256||'')||await sha256Hex(sourceArchive(exp));
    if(!digest)throw new Error('Cannot create a portable LabFlow save without a RAW SHA-256 digest.');
    marker.source.sha256=digest;data.raw=data.raw||{};data.raw.sha256=digest;zip.file('raw/source.zip',sourceArchive(exp));
    }zip.file('labflow.json',JSON.stringify(marker,null,2));zip.file('experiment.json',JSON.stringify(data,null,2));
    return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});}
  function fileName(exp){return C.safeName(exp&&exp.meta&&exp.meta.name||'experiment')+'_labflow.zip';}
  LF.Export={save:saveZip,fileName:fileName,manifest:manifest,canonicalSnapshot:canonicalSnapshot};
}());
