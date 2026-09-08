(function(){
'use strict';
const LF=window.LabFlow=window.LabFlow||{},Log=LF.Logger?LF.Logger.scope('pipeline'):null;
const REGISTRY=[];
function arr(v){return Array.isArray(v)?v:[];}
function clock(){return typeof performance!=='undefined'&&performance.now?performance.now():Date.now();}
function revision(exp){return Number(exp&&exp.sync&&exp.sync.revision||0);}
function register(spec){
  if(arguments.length>1)throw new Error('DataPipeline.register accepts one stage specification object.');
  if(!spec||!spec.id||typeof spec.run!=='function')throw new Error('Pipeline stage requires id and run.');
  if(REGISTRY.some(function(x){return x.id===spec.id;}))throw new Error('Duplicate pipeline stage: '+spec.id);
  const row=Object.assign({description:'',after:[],reads:[],writes:[],phase:'transform'},spec);
  row.after=arr(row.after).map(String);row.reads=arr(row.reads).map(String);row.writes=arr(row.writes).map(String);REGISTRY.push(row);return row;
}
function ordered(){
  const byId=new Map(REGISTRY.map(function(x){return[x.id,x];})),out=[],done=new Set(),visiting=new Set();
  function visit(stage){if(done.has(stage.id))return;if(visiting.has(stage.id))throw new Error('Pipeline dependency cycle at '+stage.id);visiting.add(stage.id);stage.after.forEach(function(id){const dep=byId.get(id);if(!dep)throw new Error('Pipeline stage '+stage.id+' depends on missing stage '+id);visit(dep);});visiting.delete(stage.id);done.add(stage.id);out.push(stage);}
  REGISTRY.forEach(visit);return out;
}
function publicStage(s){return{id:s.id,phase:s.phase,after:s.after.slice(),reads:s.reads.slice(),writes:s.writes.slice(),description:s.description};}
function stages(){return ordered().map(publicStage);}
function runStage(stage,exp,ctx){const start=clock();ctx.currentStage=stage.id;const result=stage.run(exp,ctx)||null;ctx.stages.push({id:stage.id,status:'done',durationMs:Math.round((clock()-start)*10)/10,restartFrom:result&&result.restartFrom||''});return result;}
function refresh(exp,opts){
  opts=opts||{};if(!exp)throw new Error('DataPipeline.refresh requires ExperimentData.');
  exp=LF.DataModel&&LF.DataModel.hydrate?LF.DataModel.hydrate(exp):exp;
  const sequence=ordered(),maxRestarts=Math.max(0,Number(opts.maxRestarts==null?2:opts.maxRestarts));
  const ctx={reason:opts.reason||'refresh',revision:revision(exp),stages:[],startedAt:new Date().toISOString(),validation:null,currentStage:'',restarts:0};
  if(Log)Log.info('refresh.start',{experimentId:exp.id,revision:ctx.revision,reason:ctx.reason,stages:sequence.length});
  try{
    let i=0;
    while(i<sequence.length){
      const result=runStage(sequence[i],exp,ctx);
      if(result&&result.restartFrom){
        const target=sequence.findIndex(function(s){return s.id===result.restartFrom;});
        if(target<0){const e=new Error('Pipeline restart target does not exist: '+result.restartFrom);e.code='PIPELINE_RESTART_INVALID';throw e;}
        ctx.restarts++;
        if(ctx.restarts>maxRestarts){const e=new Error('Pipeline exceeded bounded restart limit ('+maxRestarts+').');e.code='PIPELINE_RESTART_LIMIT';throw e;}
        if(Log)Log.info('refresh.restart',{experimentId:exp.id,from:sequence[i].id,to:result.restartFrom,restart:ctx.restarts});
        i=target;continue;
      }
      i++;
    }
    ctx.status='ready';ctx.validation=LF.DataContracts?LF.DataContracts.validate(exp):{ok:true,errors:[],warnings:[]};
    if(!ctx.validation.ok){const e=new Error('ExperimentData failed final pipeline validation.');e.code='DATA_CONTRACT_INVALID';e.validation=ctx.validation;throw e;}
    ctx.endedAt=new Date().toISOString();exp.pipeline={status:'ready',sourceRevision:revision(exp),reason:ctx.reason,restarts:ctx.restarts,plan:stages(),executions:ctx.stages.slice(),validation:ctx.validation,updatedAt:ctx.endedAt};
    if(Log)Log.info('refresh.end',{experimentId:exp.id,revision:revision(exp),executions:ctx.stages.length,restarts:ctx.restarts,warnings:ctx.validation.warnings.length});return exp.pipeline;
  }catch(err){
    ctx.status='error';ctx.endedAt=new Date().toISOString();exp.pipeline={status:'error',sourceRevision:revision(exp),reason:ctx.reason,restarts:ctx.restarts,plan:stages(),executions:ctx.stages.slice(),validation:ctx.validation||err.validation||null,error:{code:err.code||'PIPELINE_FAILED',message:err.message||String(err),stage:ctx.currentStage||''},updatedAt:ctx.endedAt};
    if(Log)Log.error('refresh.failed',{experimentId:exp.id,stage:ctx.currentStage||'',error:err});throw err;
  }
}
function status(exp){return exp&&exp.pipeline||{status:'not_run',sourceRevision:revision(exp),restarts:0,plan:stages(),executions:[]};}

register({id:'normalize',phase:'normalize',reads:['labflow-data'],writes:['labflow-data.shape'],run:function(exp){if(LF.DataModel&&LF.DataModel.hydrate)LF.DataModel.hydrate(exp);},description:'Normalize the LabFlow Data through the single DomainSchema.'});
register({id:'link',phase:'normalize',after:['normalize'],reads:['measurements','auxiliaryEvidence'],writes:['experiments','samples','runs','measurements.links'],run:function(exp){if(LF.DatasetCorrections&&LF.DatasetCorrections.rebuildSamples)LF.DatasetCorrections.rebuildSamples(exp);},description:'Rebuild Experiment → Sample → Run → Measurement links and backlinks.'});
register({id:'validate-structure',phase:'gate',after:['link'],reads:['domain graph'],writes:['pipeline.validation'],run:function(exp,ctx){ctx.validation=LF.DataContracts?LF.DataContracts.assert(exp):{ok:true,errors:[],warnings:[]};},description:'Fail closed before scientific analysis if domain invariants are inconsistent.'});
register({id:'analyze',phase:'derive',after:['validate-structure'],reads:['measurements','analysisSettings'],writes:['analysis','measurement derived metrics','findings'],run:function(exp){if(LF.Analysis&&LF.Analysis.analyze)LF.Analysis.analyze(exp);},description:'Calculate deterministic JV metrics, rankings and quality flags.'});
register({id:'index',phase:'derive',after:['analyze'],reads:['domain','analysis','findings'],writes:['canonical'],run:function(exp){if(LF.CanonicalStore&&LF.CanonicalStore.build)LF.CanonicalStore.build(exp);},description:'Build deterministic read indexes, aliases, relations and evidence links.'});
register({id:'review',phase:'review',after:['index'],reads:['canonical','findings'],writes:['datasetAnalysis'],run:function(exp){if(LF.DatasetCorrections&&LF.DatasetCorrections.analysis)exp.datasetAnalysis=LF.DatasetCorrections.analysis(exp,revision(exp));},description:'Build deterministic Review findings, safe fixes and semantic ambiguities.'});
register({id:'auto-cleanup',phase:'review',after:['review'],reads:['datasetAnalysis'],writes:['labflow-data','patches'],run:function(exp){if(!LF.DatasetCorrections||!LF.DatasetCorrections.applyAutomaticSafeFixes)return null;const out=LF.DatasetCorrections.applyAutomaticSafeFixes(exp);return out&&(Number(out.lastApplied||0)>0||Number(out.withdrawn||0)>0)?{restartFrom:'link'}:null;},description:'Apply only mechanically provable fixes with provenance; restart deterministic downstream stages when the LabFlow Data changed.'});
register({id:'project-design',phase:'derive',after:['auto-cleanup'],reads:['experiments','samples','auxiliaryEvidence','design'],writes:['design','designAnalysis'],run:function(exp){if(LF.DesignModel&&LF.DesignModel.ensure)LF.DesignModel.ensure(exp);if(LF.DesignAnalysis&&LF.DesignAnalysis.build)exp.designAnalysis=LF.DesignAnalysis.build(exp,revision(exp));},description:'Project source evidence into Design using stable domain IDs without overwriting researcher values.'});
register({id:'summarize',phase:'derive',after:['project-design'],reads:['analysis','design','findings'],writes:['analysisSummary','experimentBrief'],run:function(exp){if(LF.AnalysisSummary&&LF.AnalysisSummary.ensure)exp.analysisSummary=LF.AnalysisSummary.ensure(exp);if(LF.ExperimentBrief&&LF.ExperimentBrief.ensure)exp.experimentBrief=LF.ExperimentBrief.ensure(exp);},description:'Build deterministic reusable Results statistics and Experiment Brief.'});
register({id:'validate-final',phase:'gate',after:['summarize'],reads:['labflow-data','design'],writes:['pipeline.validation'],run:function(exp,ctx){ctx.validation=LF.DataContracts?LF.DataContracts.assert(exp):{ok:true,errors:[],warnings:[]};},description:'Validate the complete current domain and Design projection after all deterministic stages.'});

LF.DataPipeline={register:register,refresh:refresh,status:status,stages:stages};
}());
