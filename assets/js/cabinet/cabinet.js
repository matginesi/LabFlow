(function(){
'use strict';
const LF=window.LabFlow=window.LabFlow||{},C=LF.Core,Log=LF.Logger?LF.Logger.scope('cabinet'):null;
const LIMITS={maxBackupChars:2*1024*1024,maxItems:1000,maxLayers:100,maxTags:50,maxName:300,maxNotes:4000,maxField:2000,maxTag:120};
const KINDS={
  material:{label:'Material',plural:'Materials',description:'A material you want to reuse by name, formula or supplier reference.',fields:['materialClass','formula','purity','supplier','catalogNumber']},
  chemical:{label:'Chemical',plural:'Chemicals',description:'A reusable solute, solvent, additive or reagent reference.',fields:['chemicalRole','formula','purity','supplier','catalogNumber']},
  solution:{label:'Formulation',plural:'Formulations',description:'A solution or precursor recipe you can apply to another Design.',fields:['role','solutes','solvents','concentration','additives','preparation']},
  substrate:{label:'Substrate',plural:'Substrates',description:'A substrate and its reusable preparation or treatment.',fields:['material','treatment','dimensions']},
  stack:{label:'Device stack',plural:'Device stacks',description:'An ordered layer stack you can reuse in another device Design.',fields:['layers']},
  protocol:{label:'Process recipe',plural:'Process recipes',description:'A reusable coating, annealing and atmosphere recipe.',fields:['coating','annealing','atmosphere','notes']},
  instrument:{label:'Instrument',plural:'Instruments',description:'A reusable instrument or device reference and its usual settings.',fields:['instrumentType','manufacturer','model','settings']}
};
function clean(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function now(){return new Date().toISOString();}
function base(kind,seed){seed=seed&&typeof seed==='object'?seed:{};return Object.assign({id:seed.id||C.uid('cab'),kind:kind,name:'',tags:[],notes:'',createdAt:seed.createdAt||now(),updatedAt:seed.updatedAt||now()},seed,{kind:kind});}
function normalizeLayer(layer){layer=layer&&typeof layer==='object'?layer:{};return{id:layer.id||C.uid('cab-layer'),role:clean(layer.role||layer.layer),material:clean(layer.material||layer.name),thickness:clean(layer.thickness),process:clean(layer.process)};}
function normalize(item){item=item&&typeof item==='object'?item:{};const kind=KINDS[item.kind]?item.kind:'material';const out=base(kind,item);out.name=clean(out.name);out.tags=arr(out.tags).map(clean).filter(Boolean);out.notes=clean(out.notes);out.createdAt=out.createdAt||now();out.updatedAt=out.updatedAt||out.createdAt;
  if(kind==='material'){out.materialClass=clean(out.materialClass||'material');out.formula=clean(out.formula);out.purity=clean(out.purity);out.supplier=clean(out.supplier);out.catalogNumber=clean(out.catalogNumber);}
  if(kind==='chemical'){out.chemicalRole=clean(out.chemicalRole||'chemical');out.formula=clean(out.formula);out.purity=clean(out.purity);out.supplier=clean(out.supplier);out.catalogNumber=clean(out.catalogNumber);}
  if(kind==='solution'){['role','solutes','solvents','concentration','additives','preparation'].forEach(function(k){out[k]=clean(out[k]);});}
  if(kind==='substrate'){['material','treatment','dimensions'].forEach(function(k){out[k]=clean(out[k]);});}
  if(kind==='stack'){out.layers=arr(out.layers).map(normalizeLayer);}
  if(kind==='protocol'){['coating','annealing','atmosphere'].forEach(function(k){out[k]=clean(out[k]);});}
  if(kind==='instrument'){['instrumentType','manufacturer','model','settings'].forEach(function(k){out[k]=clean(out[k]);});}
  return out;
}
function validate(item){item=normalize(item);const issues=[];if(!clean(item.name))issues.push('Name is empty.');
if(item.kind==='solution'&&!clean(item.solutes)&&!clean(item.solvents))issues.push('Add at least a solute or solvent.');
  if(item.kind==='stack'&&!arr(item.layers).some(function(x){return clean(x.role)||clean(x.material);
  }))issues.push('Add at least one meaningful layer.');
  if(item.kind==='protocol'&&![item.coating,item.annealing,item.atmosphere,
  item.notes].some(clean))issues.push('Add at least one process field.');
  if(item.kind==='substrate'&&!clean(item.material))issues.push('Substrate material is empty.');
  if((item.kind==='material'||item.kind==='chemical')&&!clean(item.formula)&&
  !clean(item.name))issues.push('Add a name or formula.');return issues;}
function load(){const raw=LF.Storage&&LF.Storage.getCabinetState?LF.Storage.getCabinetState():{items:[]};return{items:arr(raw&&raw.items).map(normalize),updatedAt:raw&&raw.updatedAt||null};}
let state=load();
function persist(){state.items=state.items.map(normalize);
if(state.items.length>LIMITS.maxItems)throw new Error('Lab Cabinet reached its browser limit of '+LIMITS.maxItems+
  ' resources. Export or remove unused resources before adding more.');const encoded=JSON.stringify({items:state.items});
  if(encoded.length>LIMITS.maxBackupChars)throw new Error('Lab Cabinet is too large for browser storage. Export the library and remove unused resources.');
  state.updatedAt=now();if(LF.Storage&&LF.Storage.saveCabinetState&&
  !LF.Storage.saveCabinetState(state))throw new Error('Lab Cabinet could not be saved in browser storage.');return state;}
function all(){return state.items.slice();}
function get(id){return state.items.find(function(x){return String(x.id)===String(id);})||null;}
function searchable(item){return JSON.stringify([item.name,item.tags,item.notes,item.kind,item.role,item.chemicalRole,item.solutes,item.solvents,item.material,item.formula,item.layers,item.coating,item.annealing,item.atmosphere,item.manufacturer,item.model]).toLowerCase();}
function list(kind,query){let rows=all();if(kind&&kind!=='all')rows=rows.filter(function(x){return x.kind===kind;});const q=clean(query).toLowerCase();if(q)rows=rows.filter(function(x){return searchable(x).includes(q);});return rows.sort(function(a,b){return String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))||String(a.name).localeCompare(String(b.name));});}
function create(kind,seed){if(!KINDS[kind])throw new Error('Unknown Cabinet kind: '+kind);const item=normalize(Object.assign({},seed||{},{kind:kind,id:C.uid('cab'),createdAt:now(),updatedAt:now()}));if(!item.name)item.name='New '+KINDS[kind].label.toLowerCase();state.items.unshift(item);persist();if(Log)Log.info('item.created',{id:item.id,kind:item.kind,name:item.name});return item;}
function update(id,patch){const item=get(id);if(!item)throw new Error('Cabinet item not found.');Object.assign(item,clone(patch||{}),{updatedAt:now()});const normalized=normalize(item),idx=state.items.indexOf(item);state.items[idx]=normalized;persist();return normalized;}
function remove(id){const idx=state.items.findIndex(function(x){return String(x.id)===String(id);});if(idx<0)return false;const item=state.items.splice(idx,1)[0];persist();if(Log)Log.info('item.removed',{id:item.id,kind:item.kind});return true;}
function duplicate(id){const item=get(id);if(!item)throw new Error('Cabinet item not found.');const copy=clone(item);delete copy.id;delete copy.createdAt;delete copy.updatedAt;copy.name=(item.name||KINDS[item.kind].label)+' copy';return create(item.kind,copy);}
function sourceRef(item){return{type:'cabinet_snapshot',cabinetId:item.id,cabinetKind:item.kind,cabinetName:item.name,capturedAt:now()};}
function snapshot(id){const item=typeof id==='object'?normalize(id):get(id);if(!item)return null;return{source:sourceRef(item),item:clone(item)};}
function signatureSolution(v){v=v||{};return [v.role,v.solutes,v.solvents,v.concentration,v.additives].map(function(x){return clean(x).toLowerCase();}).join('|');}
function solutionMeaningful(v){return!!(v&&[v.solutes,v.solvents].some(function(x){return clean(x); }));}
function processMeaningful(p){return p&&[p.coating,p.annealing,p.atmosphere,p.notes].some(function(x){return clean(x);});}
function applyToDesign(exp,deviceId,itemId,options){options=options||{};const item=get(itemId);
if(!item)throw new Error('Cabinet item not found.');
  if(!exp||!exp.design)throw new Error('No experiment Design is loaded.');exp.design.solutions=arr(exp.design.solutions);
  exp.design.devices=arr(exp.design.devices);
  const dev=exp.design.devices.find(function(x){return String(x.id)===String(deviceId);});
  if(!dev)throw new Error('Design experiment not found.');dev.solutionIds=arr(dev.solutionIds);dev.stack=arr(dev.stack);
  dev.process=Object.assign({coating:'',annealing:'',atmosphere:'',notes:''},dev.process||{});const issues=validate(item);
  if(issues.length)throw new Error('Cabinet resource is incomplete: '+issues.join(' '));
  if(item.kind==='solution'&&!solutionMeaningful(item))throw new Error('Cabinet solution needs a solute or solvent before it can be used in Design.');
  const ref=sourceRef(item);let changed=0;
  if(item.kind==='solution'){
    const sig=signatureSolution(item),existing=exp.design.solutions.find(function(sol){return sol.cabinetRef&&String(sol.cabinetRef.cabinetId)===String(item.id)||(solutionMeaningful(sol)&&signatureSolution(sol)===sig);});let sol=existing;
    if(!sol){sol=LF.DomainSchema.create('design_solution',{name:item.name,role:item.role,solutes:item.solutes,solvents:item.solvents,concentration:item.concentration,additives:item.additives,preparation:item.preparation,evidence:'Lab Cabinet snapshot · '+item.name,status:'user_confirmed',confidence:1,provenanceKind:'cabinet_snapshot',cabinetRef:ref});exp.design.solutions.push(sol);changed++;}
    dev.solutionIds=arr(dev.solutionIds);if(!dev.solutionIds.includes(sol.id)){dev.solutionIds.push(sol.id);changed++;}
  } else if(item.kind==='stack'){
    if(options.replace!==false||!(dev.stack||[]).length){dev.stack=arr(item.layers).map(function(layer){return LF.DomainSchema.create('design_layer',Object.assign({},layer,{evidence:'Lab Cabinet snapshot · '+item.name,status:'user_confirmed',confidence:1,provenanceKind:'cabinet_snapshot',cabinetRef:ref}));});dev.stackSourceRef=ref;changed+=dev.stack.length||1;}
  } else if(item.kind==='protocol'){
    dev.process=Object.assign({coating:'',annealing:'',atmosphere:'',notes:''},dev.process||{});
['coating','annealing','atmosphere'].forEach(function(k){
      if((options.replaceProcess||!clean(dev.process[k]))&&clean(item[k])&&dev.process[k]!==item[k]){dev.process[k]=item[k];
      changed++;}});if((options.replaceProcess||!clean(dev.process.notes))&&clean(item.notes)&&
      dev.process.notes!==item.notes){dev.process.notes=item.notes;changed++;}if(changed)dev.processSourceRef=ref;
  } else if(item.kind==='substrate'){
    const layer=LF.DomainSchema.create('design_layer',{
role:'Substrate',material:item.material||item.name,process:item.treatment||'',
      evidence:'Lab Cabinet snapshot · '+item.name,status:'user_confirmed',confidence:1,provenanceKind:'cabinet_snapshot',
      cabinetRef:ref});dev.stack=arr(dev.stack);if(options.replaceSubstrate){if(dev.stack.length)dev.stack[0]=layer;
      else dev.stack.push(layer);}else dev.stack.unshift(layer);changed++;
  } else if(item.kind==='material'){
    const index=Number(options.layerIndex);
if(Number.isInteger(index)&&dev.stack&&dev.stack[index]){const next=item.name||item.formula;
      if(dev.stack[index].material!==next){dev.stack[index].material=next;changed++;}dev.stack[index].cabinetRef=ref;
      dev.stack[index].provenanceKind='cabinet_snapshot';dev.stack[index].status='user_confirmed';
      }else throw new Error('Choose a target stack layer before applying a material.');
  } else throw new Error('This Cabinet item is not directly applicable to Design.');
  if(changed){dev.status='user_confirmed';dev.cabinetAssisted=true;dev.cabinetAssistedAt=now();}
  return{changed:changed,item:item,device:dev};
}
function saveDesignSolution(exp,solutionId){const sol=(exp&&exp.design&&exp.design.solutions||[]).find(function(x){
return String(x.id)===String(solutionId);});if(!sol)throw new Error('Design solution not found.');
  if(!solutionMeaningful(sol))throw new Error('Add a solute or solvent before saving this solution to Lab Cabinet.');
  return create('solution',{name:sol.name||'Saved formulation',role:sol.role,solutes:sol.solutes,solvents:sol.solvents,
  concentration:sol.concentration,additives:sol.additives,preparation:sol.preparation,tags:['from-design'],
  notes:'Saved from LabFlow Design.'});}
function saveDesignStack(exp,deviceId){const dev=(exp&&exp.design&&exp.design.devices||[]).find(function(x){
return String(x.id)===String(deviceId);});if(!dev)throw new Error('Design experiment not found.');
  if(!(dev.stack||[]).some(function(x){return clean(x&&x.role)||clean(x&&x.material);
  }))throw new Error('The selected experiment has no meaningful stack to save.');
  return create('stack',{name:(dev.name||'Experiment')+' stack',layers:(dev.stack||[]).map(function(x){return{
  role:x.role,material:x.material,thickness:x.thickness,process:x.process};
  }),tags:['from-design'],notes:'Saved from LabFlow Design.'});}
function saveDesignProtocol(exp,deviceId){const dev=(exp&&exp.design&&exp.design.devices||[]).find(function(x){
return String(x.id)===String(deviceId);});if(!dev)throw new Error('Design experiment not found.');
  const p=dev.process||{};if(!processMeaningful(p))throw new Error('The selected experiment has no process information to save.');
  return create('protocol',{name:(dev.name||'Experiment')+' process',coating:p.coating,annealing:p.annealing,
  atmosphere:p.atmosphere,notes:p.notes,tags:['from-design']});}
function matchProposal(proposal){
  proposal=proposal&&typeof proposal==='object'?proposal:{};const matches=[];
  const cabinetSolutions=list('solution',''),cabinetStacks=list('stack',''),cabinetProtocols=list('protocol','');
  (proposal.solutions||[]).forEach(function(sol,index){if(!solutionMeaningful(sol))return;
const sig=signatureSolution(sol),name=clean(sol.name).toLowerCase();
    const item=cabinetSolutions.find(function(c){
    return solutionMeaningful(c)&&((name&&clean(c.name).toLowerCase()===name)||signatureSolution(c)===sig);});
    if(item)matches.push({part:'solution',proposalIndex:index,cabinetId:item.id,kind:item.kind,name:item.name});});
  const device=proposal.devices&&proposal.devices[0]||{},stack=device.stack||proposal.stack||[],stackSig=arr(stack).map(function(x){return clean(x.material||x.name).toLowerCase();}).filter(Boolean).join('/');
  if(stackSig){const item=cabinetStacks.find(function(c){return arr(c.layers).map(function(x){return clean(x.material||x.name).toLowerCase();}).filter(Boolean).join('/')===stackSig;});if(item)matches.push({part:'stack',proposalIndex:0,cabinetId:item.id,kind:item.kind,name:item.name});}
  const process=device.process||proposal.process||{};
if(processMeaningful(process)){const pSig=[process.coating,process.annealing,process.atmosphere].map(function(x){
    return clean(x).toLowerCase();}).join('|'),item=cabinetProtocols.find(function(c){
    return[c.coating,c.annealing,c.atmosphere].map(function(x){return clean(x).toLowerCase();}).join('|')===pSig;});
    if(item)matches.push({part:'process',proposalIndex:0,cabinetId:item.id,kind:item.kind,name:item.name});}
  return matches;
}
function compactForAI(kind,limit){return list(kind||'all','').filter(function(item){return validate(item).length===0;
}).slice(0,Math.max(1,Number(limit)||16)).map(function(item){const out={
  id:item.id,kind:item.kind,name:item.name,tags:item.tags};
  if(item.kind==='solution')Object.assign(out,{
  role:item.role,solutes:item.solutes,solvents:item.solvents,concentration:item.concentration,additives:item.additives});
  if(item.kind==='stack')out.layers=item.layers.map(function(x){return{
  role:x.role,material:x.material,thickness:x.thickness};});
  if(item.kind==='substrate')Object.assign(out,{material:item.material,treatment:item.treatment});
  if(item.kind==='protocol')Object.assign(out,{
  coating:item.coating,annealing:item.annealing,atmosphere:item.atmosphere,notes:item.notes});
  if(item.kind==='material')Object.assign(out,{materialClass:item.materialClass,formula:item.formula});
  if(item.kind==='chemical')Object.assign(out,{chemicalRole:item.chemicalRole,formula:item.formula,purity:item.purity});
  return out;});}
function usage(exp,itemId){const id=String(itemId||''),out={
solutions:0,layers:0,stacks:0,processes:0,total:0,experiments:[]},used=new Set();if(!exp||!exp.design)return out;
  (exp.design.solutions||[]).forEach(function(sol){if(sol.cabinetRef&&String(sol.cabinetRef.cabinetId)===id){
  out.solutions++;}});(exp.design.devices||[]).forEach(function(dev){let n=0;
  if(dev.stackSourceRef&&String(dev.stackSourceRef.cabinetId)===id){out.stacks++;n++;
  }if(dev.processSourceRef&&String(dev.processSourceRef.cabinetId)===id){out.processes++;n++;
  }(dev.stack||[]).forEach(function(layer){if(layer.cabinetRef&&String(layer.cabinetRef.cabinetId)===id){out.layers++;n++;
  }});(dev.solutionIds||[]).forEach(function(solId){const sol=(exp.design.solutions||[]).find(function(x){
  return String(x.id)===String(solId);});if(sol&&sol.cabinetRef&&String(sol.cabinetRef.cabinetId)===id)n++;});
  if(n)used.add(dev.id);});out.total=out.solutions+out.layers+out.stacks+out.processes;out.experiments=Array.from(used);
  return out;}
function exportState(){return{kind:'labflow_cabinet',exportedAt:now(),items:all().map(clone)};}
function validateImportPayload(parsed,rawChars){
  if(rawChars>LIMITS.maxBackupChars)throw new Error('Cabinet JSON is too large for the browser (limit '+Math.round(LIMITS.maxBackupChars/1024/1024)+' MB).');
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Cabinet JSON is invalid.');
  const items=arr(parsed.items);if(!items.length)throw new Error('Cabinet JSON contains no resources.');if(items.length>LIMITS.maxItems)throw new Error('Cabinet JSON contains more than '+LIMITS.maxItems+' resources.');
  const seen=new Set();
  items.forEach(function(item,index){
    if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Cabinet item '+(index+1)+' must be an object.');
    const id=clean(item.id);if(id){if(seen.has(id))throw new Error('Cabinet JSON contains duplicate id "'+id+'".');seen.add(id);}
    if(clean(item.name).length>LIMITS.maxName)throw new Error('Cabinet item '+(index+1)+' name is too long.');
    if(clean(item.notes).length>LIMITS.maxNotes)throw new Error('Cabinet item '+(index+1)+' notes are too long.');
    const tags=arr(item.tags);if(tags.length>LIMITS.maxTags)throw new Error('Cabinet item '+(index+1)+' has too many tags.');tags.forEach(function(tag){if(clean(tag).length>LIMITS.maxTag)throw new Error('Cabinet item '+(index+1)+' contains an oversized tag.');});
    const layers=arr(item.layers);if(layers.length>LIMITS.maxLayers)throw new Error('Cabinet item '+(index+1)+' has too many stack layers.');
    Object.keys(item).forEach(function(key){if(typeof item[key]==='string'&&key!=='notes'&&clean(item[key]).length>LIMITS.maxField)throw new Error('Cabinet item '+(index+1)+' field "'+key+'" is too long.');});
    layers.forEach(function(layer){if(!layer||typeof layer!=='object'||Array.isArray(layer))throw new Error('Cabinet item '+(index+1)+' contains an invalid stack layer.');Object.keys(layer).forEach(function(key){if(typeof layer[key]==='string'&&clean(layer[key]).length>LIMITS.maxField)throw new Error('Cabinet item '+(index+1)+' contains an oversized layer field.');});});
  });
  return items;
}
function importState(payload,mode){let parsed=payload,rawChars=0;if(typeof payload==='string'){rawChars=payload.length;
if(rawChars>LIMITS.maxBackupChars)throw new Error('Cabinet JSON is too large for the browser.');
  parsed=JSON.parse(payload);}else{try{rawChars=JSON.stringify(payload||{}).length;
  }catch(_){throw new Error('Cabinet JSON is invalid.');
  }}const incoming=validateImportPayload(parsed,rawChars).map(normalize),next=mode==='replace'?[]:state.items.map(clone);
  mode=mode==='replace'?'replace':'merge';const byId=new Map(next.map(function(x){return[String(x.id),x];}));
  incoming.forEach(function(item){if(byId.has(String(item.id))){const copy=clone(item);copy.id=C.uid('cab');
  copy.name=(copy.name||KINDS[copy.kind].label)+' imported';next.push(normalize(copy));}else{next.push(item);
  byId.set(String(item.id),item);}});if(next.length>LIMITS.maxItems)throw new Error('Import would exceed the Lab Cabinet limit of '+
  LIMITS.maxItems+' resources.');const previous=state;state={items:next,updatedAt:previous.updatedAt};try{persist();
  }catch(error){state=previous;throw error;}return{mode:mode,imported:incoming.length,total:state.items.length};}
function reset(next){state={items:arr(next&&next.items).map(normalize),updatedAt:next&&next.updatedAt||null};persist();return state;}
LF.Cabinet={limits:function(){return clone(LIMITS);},kinds:function(){return clone(KINDS);
},all:all,list:list,get:get,create:create,update:update,remove:remove,duplicate:duplicate,validate:validate,
  snapshot:snapshot,applyToDesign:applyToDesign,saveDesignSolution:saveDesignSolution,saveDesignStack:saveDesignStack,
  saveDesignProtocol:saveDesignProtocol,matchProposal:matchProposal,compactForAI:compactForAI,usage:usage,
  exportState:exportState,importState:importState,reset:reset};
if(Log)Log.info('ready',{items:state.items.length,kinds:Object.keys(KINDS)});
}());
