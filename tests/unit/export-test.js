'use strict';
require('../../assets/js/core.js');
require('../../assets/js/experiment/domain-schema.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/export/export.js');
function assert(a,e,l){if(JSON.stringify(a)!==JSON.stringify(e))throw new Error((l||'assert')+': expected '+JSON.stringify(e)+' got '+JSON.stringify(a));}
function truthy(v,l){if(!v)throw new Error((l||'assert')+': expected truthy');}
async function sample(){const z=new JSZip();z.file('demo/a.txt','hello');const arc=await z.generateAsync({type:'arraybuffer'}),exp=window.LabFlow.DataModel.create({bytes:arc,sourceName:'source.zip'});exp.meta.name='Demo';exp.samples=[window.LabFlow.DomainSchema.create('sample',{id:'s1',name:'A',measurementIds:['m1']})];exp.measurements=[window.LabFlow.DomainSchema.create('measurement',{id:'m1',sampleId:'s1',sample:'A',bestEff:20})];exp.patches=[window.LabFlow.DomainSchema.create('patch',{id:'p1',patchType:'manual',target:{kind:'sample',id:'s1'},operation:'set',field:'name',from:'a',to:'A',source:'user',reason:'review',status:'applied'})];return{exp,arc};}
module.exports=function(t,LF){
 t['Export ZIP is a portable LabFlow save with immutable RAW source']=async function(){const x=await sample(),blob=await LF.Export.save(x.exp),zip=await JSZip.loadAsync(await blob.arrayBuffer()),names=Object.keys(zip.files);truthy(names.includes('labflow.json'),'marker');truthy(names.includes('experiment.json'),'experiment');truthy(names.includes('raw/source.zip'),'raw');const marker=JSON.parse(await zip.file('labflow.json').async('string'));assert(marker.format,'labflow-save','format');const data=JSON.parse(await zip.file('experiment.json').async('string'));assert(data.samples[0].name,'A','data representation');truthy(!data.raw.sourceArchive,'source bytes not duplicated in JSON');const src=new Uint8Array(x.arc),saved=new Uint8Array(await zip.file('raw/source.zip').async('arraybuffer'));assert(saved.length,src.length,'raw length');for(let i=0;i<src.length;i++)assert(saved[i],src[i],'raw byte '+i);};
 t['Export ZIP filename is explicit LabFlow save']=async function(){const x=await sample();assert(LF.Export.fileName(x.exp),'Demo_labflow.zip','filename');};
};
