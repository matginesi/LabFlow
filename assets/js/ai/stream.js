/*
 * SSE and stream parsing for compatible provider responses.
 * Boundary: Streaming mechanics do not decide Action semantic success.
 */
(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{},Errors=LF.AITransportErrors;
  if(!Errors)throw new Error('AI transport error module is not loaded.');
  const STREAM_DIAGNOSTIC_CHARS=131072;
  function estimateTokens(text){return Math.max(0,Math.round(String(text||'').length/4));}
  function streamPart(value){if(value==null)return'';if(typeof value==='string')return value;if(Array.isArray(value))return value.map(streamPart).join('');if(typeof value==='object')return streamPart(value.text||value.content||value.value||'');return String(value);}
  function mergeStreamContent(current,incoming){current=String(current||'');incoming=String(incoming||'');
if(!incoming)return current;if(!current)return incoming;if(incoming===current)return current;
    if(incoming.length>current.length&&incoming.indexOf(current)===0)return incoming;
    if(incoming.length>=24&&current.endsWith(incoming))return current;
    const max=Math.min(current.length,incoming.length,4096);for(let n=max;n>=16;
    n--){if(current.slice(-n)===incoming.slice(0,n))return current+incoming.slice(n);}return current+incoming;}
  function outputLoopDetected(value){const s=String(value||'').replace(/\s+/g,' ').trim();for(const n of [512,1024,2048]){if(s.length<n*3)continue;const a=s.slice(-n),b=s.slice(-2*n,-n),c=s.slice(-3*n,-2*n);if(a===b&&b===c)return true;}return false;}
  async function readEventStream(response,onBytes,onProgress,onMeaningful,startedAt,budgetTokens,onReasoning,providerId){
    const reader=response.body&&response.body.getReader?response.body.getReader():null;if(!reader)throw new Error('The provider declared streaming but the browser exposed no readable response body.');
    const decoder=new TextDecoder(),state={content:'',reasoning:'',finishReason:'',usage:null,model:'',requestId:'',events:0,meaningfulEvents:0,bytes:0,ttftMs:null,budgetTokens:budgetTokens||null,done:false},started=startedAt||performance.now();let raw='',buffer='';
    function event(data){if(!data)return false;if(data==='[DONE]'){state.done=true;return true;}let obj;
try{obj=JSON.parse(data);}catch(error){const invalid=new Error('Provider returned an invalid SSE JSON event.');
      invalid.cause=error;invalid.providerResponse=data;throw invalid;
      }if(obj.error)throw Errors.parseProviderError(JSON.stringify(obj),Number(obj.error.status||0),obj.request_id||'',null,
      providerId);const choice=obj.choices&&obj.choices[0]||{},delta=choice.delta||choice.message||{}
      ,content=streamPart(delta.content||delta.text||choice.text||obj.output_text||obj.response),
      reasoning=streamPart(delta.reasoning_content||delta.reasoning||delta.reasoning_details||choice.reasoning_content||
      obj.reasoning_content||obj.reasoning);state.model=obj.model||state.model;
      state.requestId=obj.request_id||obj.id||state.requestId;
      const meaningful=!!(content||reasoning||choice.finish_reason||obj.usage);
      if((content||reasoning)&&state.ttftMs==null)state.ttftMs=Math.round(performance.now()-started);
      state.content=mergeStreamContent(state.content,content);state.reasoning=mergeStreamContent(state.reasoning,reasoning);
      state.finishReason=choice.finish_reason||state.finishReason;
      if(reasoning&&onReasoning)onReasoning({requestId:state.requestId,model:state.model,reasoning:reasoning,
      totalReasoning:state.reasoning});if(meaningful){state.meaningfulEvents++;if(onMeaningful)onMeaningful();
      }if(outputLoopDetected(state.content)||outputLoopDetected(state.reasoning)){
      const repeated=outputLoopDetected(state.content)?state.content:state.reasoning,
      loop=new Error('The model entered a repeated-output loop. The checkpoint was stopped before storing duplicated content.');
      loop.code='MODEL_OUTPUT_LOOP';loop.providerResponse=repeated.slice(-12000);throw loop;
      }const charGuard=budgetTokens?Math.max(24000,Number(budgetTokens)*8):4000000;
      if(state.content.length+state.reasoning.length>charGuard){
      const limit=new Error('Provider output exceeded the bounded work-unit size before completion.');
      limit.code='MODEL_OUTPUT_LIMIT_GUARD';limit.providerResponse=(state.content||state.reasoning).slice(-12000);throw limit;
      }state.usage=obj.usage||state.usage;state.events++;
      if(onProgress){const elapsedMs=Math.round(performance.now()-started),
      reported=state.usage&&Number.isFinite(Number(state.usage.completion_tokens))?Number(state.usage.completion_tokens):null,
      tokens=reported==null?estimateTokens(state.content+state.reasoning):reported,
      generationMs=state.ttftMs==null?0:Math.max(0,elapsedMs-state.ttftMs),
      rate=generationMs>=100?tokens/(generationMs/1000):null;
      onProgress({content:state.content,reasoning:state.reasoning,finishReason:state.finishReason,usage:state.usage,
      events:state.events,meaningfulEvents:state.meaningfulEvents,bytes:state.bytes,ttftMs:state.ttftMs,elapsedMs,
      generationMs,tokens,rate:Number.isFinite(rate)?rate:null,estimated:reported==null,budgetTokens:budgetTokens||null});
      }return false;}
    function consume(final){const blocks=buffer.split(/\r?\n\r?\n/);if(final)buffer='';else buffer=blocks.pop()||'';let terminal=false;for(const block of blocks){const data=block.split(/\r?\n/).filter(line=>line.indexOf('data:')===0).map(line=>line.slice(5).trimStart()).join('\n');if(data&&event(data))terminal=true;}return terminal;}
    try{while(true){const part=await reader.read();if(part.done)break;state.bytes+=part.value.byteLength;
const text=decoder.decode(part.value,{stream:true});onBytes(text);raw=(raw+text).slice(-STREAM_DIAGNOSTIC_CHARS);
      buffer+=text;if(consume(false)){try{Promise.resolve(reader.cancel()).catch(function(){});}catch(_){}break;
      }}const tail=decoder.decode();if(tail){raw=(raw+tail).slice(-STREAM_DIAGNOSTIC_CHARS);buffer+=tail;
      }if(!state.done)consume(true);return{rawText:raw,json:{
      id:state.requestId,request_id:state.requestId,model:state.model,choices:[{message:{
      role:'assistant',content:state.content,reasoning_content:state.reasoning},finish_reason:state.finishReason}
      ],usage:state.usage||null},stream:state};}catch(err){try{await reader.cancel();}catch(_){}throw err;}
  }
  LF.AIStream={STREAM_DIAGNOSTIC_CHARS,mergeStreamContent,outputLoopDetected,readEventStream};
})();
