'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/ai/transport.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error((label || 'assert') + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
  }
}

module.exports = function (t, LF) {
  const AI = LF.AI;

  t['resolveChatUrl normalizes bare and double-suffixed endpoints'] = function () {
    assert(AI.resolveChatUrl('https://api.z.ai/api/paas/v4'), 'https://api.z.ai/api/paas/v4/chat/completions', 'append');
    assert(AI.resolveChatUrl('https://api.z.ai/api/paas/v4/chat/completions'), 'https://api.z.ai/api/paas/v4/chat/completions', 'already complete');
    assert(AI.resolveChatUrl('https://x/v1/chat/completions/chat/completions'), 'https://x/v1/chat/completions', 'dedupe');
    assert(AI.resolveChatUrl(''), '', 'empty');
  };

  t['validateHttpUrl accepts http/https and rejects others'] = function () {
    assert(AI.validateHttpUrl('http://127.0.0.1:11434/v1'), 'http://127.0.0.1:11434/v1', 'http local');
    let threw = false;
    try { AI.validateHttpUrl('ftp://example.com'); } catch (err) { threw = /http/.test(err.message); }
    assert(threw, true, 'rejects ftp');
  };

  t['stream merge rejects cumulative and overlapping duplicate chunks'] = function () {
    assert(AI.mergeStreamContent('abcdef', 'abcdefghi'), 'abcdefghi', 'cumulative replaces');
    assert(AI.mergeStreamContent('0123456789abcdefghijklmnop', 'abcdefghijklmnopQRST'), '0123456789abcdefghijklmnopQRST', 'overlap once');
    assert(AI.mergeStreamContent('prefix repeated payload that is long enough', 'repeated payload that is long enough'), 'prefix repeated payload that is long enough', 'duplicate large suffix ignored');
  };

  t['repeated model output loop is detected before unbounded growth'] = function () {
    const block='x'.repeat(512);
    assert(AI.outputLoopDetected(block+block+block), true, 'triple repeated block');
    assert(AI.outputLoopDetected(block+'y'.repeat(512)+block), false, 'non repeated stream');
  };

  t['SSE progress exposes live output tokens and tok/s'] = async function () {
    const oldFetch=global.fetch,oldLocation=global.location,encoder=new TextEncoder();let progress=null;global.location={protocol:'https:',origin:'https://labflow.test'};
    global.fetch=async function(){const body=new ReadableStream({start:function(controller){setTimeout(function(){controller.enqueue(encoder.encode('data: {"id":"rate-test","model":"test-model","choices":[{"delta":{"content":"abcdefgh"}}],"usage":{"completion_tokens":2}}\n\ndata: {"choices":[{"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'));controller.close();},20);}});return{ok:true,status:200,statusText:'OK',headers:new Headers({'content-type':'text/event-stream'}),body:body};};
    LF.Storage={getAiSettings:function(){return{provider:'custom',endpoint:'https://example.com/v1',model:'test-model',inactivityTimeoutMs:60000,streaming:true};},getApiKey:function(){return'';}};LF.AIProviders={custom:{keyRequired:false,tokenParam:'max_tokens',supportsStreaming:true,supportsTemperature:true,rateLimit:{retries:0}}};
    try{const spec=AI.buildRequest({messages:[{role:'user',content:'rate'}],stream:true,maxTokens:64}),result=await AI.send(spec,{onProgress:function(value){progress=value;}});assert(result.content,'abcdefgh','stream content');assert(progress.tokens,2,'reported completion tokens');assert(progress.estimated,false,'provider usage is exact');assert(Number(progress.rate)>0,true,'live tok/s');}
    finally{global.fetch=oldFetch;if(oldLocation===undefined)delete global.location;else global.location=oldLocation;delete LF.Storage;delete LF.AIProviders;}
  };

  t['local endpoint detection covers loopback and RFC1918 addresses'] = function () {
    assert(AI.isLocalAddress('http://127.0.0.1:1234/v1/chat/completions'), true, 'loopback');
    assert(AI.isLocalAddress('http://localhost:1234/v1/chat/completions'), true, 'localhost');
    assert(AI.isLocalAddress('http://192.168.1.20:1234/v1/chat/completions'), true, 'lan');
    assert(AI.isLocalAddress('https://api.example.com/v1/chat/completions'), false, 'public');
  };

  t['estimateTokens approximates 4 chars per token'] = function () {
    assert(AI.estimateTokens(''), 0, 'empty');
    assert(AI.estimateTokens('abcd'), 1, 'one token');
    assert(AI.estimateTokens('abcdefgh'), 2, 'two tokens');
    assert(AI.estimateTokens(null), 0, 'null');
  };

  t['buildRequest produces a valid Chat Completions body'] = function () {
    LF.Storage = {
      getAiSettings: function () { return { provider: 'zai', endpoint: 'https://api.z.ai/api/paas/v4', model: 'glm-4.7-flash', temperature: 0.4, maxTokens: 2200, inactivityTimeoutMs: 90000, streaming: true }; },
      getApiKey: function () { return 'test-key'; }
    };
    LF.AIProviders = { zai: { keyRequired: true, tokenParam: 'max_tokens', supportsStreaming: true, supportsTemperature: true } };
    const spec = AI.buildRequest({ provider: 'zai', messages: [{ role: 'user', content: 'hi' }], stream: true, maxTokens: 512 });
    assert(spec.url, 'https://api.z.ai/api/paas/v4/chat/completions', 'url');
    assert(spec.headers.Authorization, 'Bearer test-key', 'auth header');
    assert(spec.body.model, 'glm-4.7-flash', 'model');
    assert(spec.body.stream, true, 'stream');
    assert(spec.body.max_tokens, 512, 'max tokens');
    delete LF.Storage; delete LF.AIProviders;
  };

  t['provider-declared headers are applied and Z.AI omits unsupported stream options'] = function () {
    let requestedProvider='';
    LF.Storage = {
      getAiSettings: function () { return { provider: 'zai', endpoint: 'https://api.z.ai/api/paas/v4', model: 'glm-4.7-flash', inactivityTimeoutMs: 90000, streaming: true }; },
      getApiKey: function (providerId) { requestedProvider=providerId;return 'zai-key'; }
    };
    LF.AIProviders = { zai: { keyRequired:true, supportsStreaming:true, tokenParam:'max_tokens', headers:{'Accept-Language':'en-US,en'} } };
    const spec=AI.buildRequest({messages:[{role:'user',content:'hi'}],stream:true,maxTokens:128});
    assert(requestedProvider,'zai','provider-scoped credential lookup');
    assert(spec.headers['Accept-Language'],'en-US,en','documented Z.AI header');
    assert(Object.prototype.hasOwnProperty.call(spec.body,'stream_options'),false,'undocumented extension omitted');
    delete LF.Storage;delete LF.AIProviders;
  };

  t['OpenRouter nested model metadata exposes output and context limits'] = function () {
    const cap=AI.capabilityFromRow({context_length:131072,top_provider:{max_completion_tokens:32768}},'OpenRouter model metadata');
    assert(cap.maxOutputTokens,32768,'nested output limit');
    assert(cap.contextWindow,131072,'context limit');
    assert(cap.exactOutput,true,'exact output capability');
  };

  t['buildRequest preserves an absolute Action deadline independently of inactivity timeout'] = function () {
    LF.Storage={getAiSettings:function(){return{provider:'custom',endpoint:'https://example.com/v1',model:'x',inactivityTimeoutMs:180000,streaming:false};},getApiKey:function(){return'';}};
    LF.AIProviders={custom:{keyRequired:false,tokenParam:'max_tokens',supportsStreaming:true,supportsTemperature:true,requestTimeoutMs:90000}};
    const spec=AI.buildRequest({messages:[{role:'user',content:'brief'}],stream:false,maxTokens:3072,timeoutMs:180000,hardTimeoutMs:90000});
    assert(spec.body.max_tokens,3072,'bounded Action target');
    assert(spec.timeoutMs,180000,'inactivity window remains distinct');
    assert(spec.hardTimeoutMs,90000,'absolute deadline');
    delete LF.Storage;delete LF.AIProviders;
  };

  t['buildRequest honors jsonMode and provider-declared thinking controls'] = function () {
    LF.Storage = {
      getAiSettings: function () { return { provider: 'ollama', endpoint: 'http://127.0.0.1:11434/v1', model: 'gemma3', temperature: 0.2, maxTokens: 512, inactivityTimeoutMs: 60000, streaming: false }; },
      getApiKey: function () { return ''; }
    };
    LF.AIProviders = { ollama: { keyRequired: false, tokenParam: 'max_tokens', supportsStreaming: true, supportsTemperature: true, supportsJsonMode: true, thinkingModes:{off:{reasoning_effort:'none'}} } };
    const spec = AI.buildRequest({ provider: 'ollama', messages: [{ role: 'user', content: 'j' }], stream: false, jsonMode: true, thinkingMode:'off' });
    assert(spec.body.response_format, { type: 'json_object' }, 'json mode');
    assert(spec.body.stream, false, 'stream false honored');
    assert(spec.body.reasoning_effort, 'none', 'reasoning effort');
    assert(spec.thinkingMode, 'off', 'applied thinking mode');
    delete LF.Storage; delete LF.AIProviders;
  };

  t['thinking adapter applies only provider-declared request fields'] = function () {
    const auto={},unsupported={},off={},on={};
    assert(AI.applyThinkingMode(auto,{thinkingModes:{off:{reasoning_effort:'none'}}},'auto').applied,'auto','auto mode');
    assert(auto,{},'auto sends no override');
    assert(AI.applyThinkingMode(unsupported,{},'off').applied,'auto','unsupported fallback');
    assert(unsupported,{},'unsupported provider receives no invented field');
    const modes={off:{thinking:{type:'disabled'}},on:{thinking:{type:'enabled'}}};
    assert(AI.applyThinkingMode(off,{thinkingModes:modes},'off').applied,'off','off applied');assert(off.thinking,{type:'disabled'},'off payload');
    assert(AI.applyThinkingMode(on,{thinkingModes:modes},'on').applied,'on','on applied');assert(on.thinking,{type:'enabled'},'on payload');
  };

  t['connection probe is minimal and independent of model capability detection']=function(){
    const provider={connectionTestMaxTokens:128};
    const optional=AI.connectionProbePolicy({connectionTestMaxTokens:128,thinkingModes:{off:{reasoning_effort:'none'}}});
    const unknown=AI.connectionProbePolicy({id:'custom',connectionTestMaxTokens:128});
    assert(optional.thinkingMode,'off','connection probe disables supported thinking');
    assert(unknown.thinkingMode,'auto','unsupported provider receives no invented control');
    [optional,unknown].forEach(function(policy){assert(policy.maxTokens,16,'connection probe clamps to tiny budget');});
  };

  t['normal capability resolution never probes provider metadata implicitly']=async function(){
    const oldFetch=global.fetch;let calls=0;global.fetch=async function(){calls++;throw new Error('unexpected metadata request');};
    LF.Storage={getAiSettings:function(){return{provider:'custom',endpoint:'https://models.example/v1',model:'manual-model'};},getApiKey:function(){return'';}};LF.AIProviders={custom:{keyRequired:false}};
    try{const cap=await AI.resolveModelCapabilities({provider:'custom',endpoint:'https://models.example/v1',model:'manual-model'});assert(calls,0,'no GET/list-models call');assert(cap.reasoningStatus,'unknown','conservative capability fallback');assert(cap.model,'manual-model','configured model preserved');}
    finally{global.fetch=oldFetch;delete LF.Storage;delete LF.AIProviders;}
  };


  t['buildRequest omits output token field when no cap is resolved'] = function () {
    LF.Storage={getAiSettings:function(){return{provider:'custom',endpoint:'https://example.com/v1',model:'x',inactivityTimeoutMs:60000,streaming:false};},getApiKey:function(){return'';}};
    LF.AIProviders={custom:{keyRequired:false,tokenParam:'max_tokens',supportsStreaming:true,supportsTemperature:true}};
    const spec=AI.buildRequest({messages:[{role:'user',content:'hi'}],stream:false});
    assert(Object.prototype.hasOwnProperty.call(spec.body,'max_tokens'),false,'no invented 8K limit');delete LF.Storage;delete LF.AIProviders;
  };

  t['provider capability and user caps resolve to the tightest valid budget'] = function () {
    assert(AI.knownCapability('openai','gpt-5-mini').maxOutputTokens,128000,'known OpenAI limit');
    assert(AI.knownCapability('zai','glm-4.7-flash').maxOutputTokens,131072,'known ZAI limit');
    assert(AI.resolveOutputBudget({maxOutputTokens:128000},0,64000,1000),64000,'global cap');
    assert(AI.resolveOutputBudget({maxOutputTokens:128000},32000,64000,1000),32000,'action/assistant cap');
    assert(AI.resolveOutputBudget({contextWindow:8192},0,0,2000),5680,'context ceiling subtracts input and reserve');
    assert(AI.resolveOutputBudget({},0,0,1000),null,'unknown remains provider default');
  };

  t['thinking policy reconciles Action intent with model capability']=function(){
    const non=AI.resolveThinkingPolicy({reasoningStatus:'none'},'on','auto');assert(non.transportMode,'auto','do not send thinking to non-reasoning model');assert(non.effective,'off','non-reasoning effective state');
    const required=AI.resolveThinkingPolicy({reasoningStatus:'required',reasoningDefault:'medium'},'off','auto');assert(required.transportMode,'auto','do not disable a reasoning-required model');assert(required.effective,'required','required fallback visible');
    const optional=AI.resolveThinkingPolicy({reasoningStatus:'optional'},'off','auto');assert(optional.transportMode,'off','Action can disable optional reasoning');
    const override=AI.resolveThinkingPolicy({reasoningStatus:'optional'},'off','on');assert(override.transportMode,'on','global override wins explicitly');
    const unknown=AI.resolveThinkingPolicy({reasoningStatus:'unknown'},'on','auto');assert(unknown.transportMode,'auto','unknown capability receives no speculative field');assert(unknown.effective,'unknown','unknown effective state');
  };

  t['known model metadata distinguishes reasoning and non-reasoning models']=function(){
    assert(AI.knownCapability('openai','gpt-4.1-mini').reasoningStatus,'none','GPT-4.1 non-reasoning');
    assert(AI.knownCapability('openai','gpt-5.2').reasoningStatus,'optional','newer GPT-5 configurable reasoning');
    assert(AI.knownCapability('openai','gpt-5-pro').reasoningStatus,'required','GPT-5 pro required reasoning');
    const openRouter=AI.capabilityFromRow({supported_parameters:['max_tokens'],context_length:8192},'OpenRouter model metadata');assert(openRouter.reasoningStatus,'none','OpenRouter absence is explicit for a concrete model');
  };

  t['Gemini capability probe reads outputTokenLimit from the native Models API'] = async function () {
    const oldFetch=global.fetch;let seen='';global.fetch=async function(url){seen=url;return{ok:true,status:200,headers:{get:function(){return null;}},text:async function(){return JSON.stringify({name:'models/gemini-test',inputTokenLimit:1000000,outputTokenLimit:65536});}};};
    LF.Storage={getAiSettings:function(){return{provider:'gemini',endpoint:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',model:'gemini-test'};},getApiKey:function(){return'key';}};LF.AIProviders={gemini:{keyRequired:true}};
    try{const cap=await AI.resolveModelCapabilities({provider:'gemini',endpoint:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',model:'gemini-test',apiKey:'key',force:true});assert(/v1beta\/models\/gemini-test/.test(seen),true,'native model endpoint');assert(cap.maxOutputTokens,65536,'output limit');assert(cap.contextWindow,1000000,'input/context limit');}
    finally{global.fetch=oldFetch;delete LF.Storage;delete LF.AIProviders;}
  };


  t['Ollama capability probe reads num_predict and model context'] = async function () {
    const oldFetch=global.fetch;let seen={};global.fetch=async function(url,opts){seen={url:url,body:JSON.parse(opts.body)};return{ok:true,status:200,headers:{get:function(){return null;}},text:async function(){return JSON.stringify({parameters:'temperature 0.2\nnum_predict 12288',model_info:{'qwen.context_length':65536},capabilities:['completion','thinking']});}};};
    LF.Storage={getAiSettings:function(){return{provider:'ollama',endpoint:'http://127.0.0.1:11434/v1',model:'qwen-test'};},getApiKey:function(){return'';}};LF.AIProviders={ollama:{keyRequired:false}};
    try{const cap=await AI.resolveModelCapabilities({provider:'ollama',endpoint:'http://127.0.0.1:11434/v1',model:'qwen-test',force:true});assert(seen.url,'http://127.0.0.1:11434/api/show','native show URL');assert(seen.body.model,'qwen-test','show model');assert(cap.maxOutputTokens,12288,'num_predict');assert(cap.contextWindow,65536,'model context');assert(cap.exactOutput,true,'explicit output limit');assert(cap.reasoningStatus,'optional','thinking capability');}
    finally{global.fetch=oldFetch;delete LF.Storage;delete LF.AIProviders;}
  };

  t['LM Studio capability probe reads loaded context without inventing output max'] = async function () {
    const oldFetch=global.fetch;let seen='';global.fetch=async function(url){seen=url;return{ok:true,status:200,headers:{get:function(){return null;}},text:async function(){return JSON.stringify({models:[{key:'local-model',max_context_length:131072,loaded_instances:[{id:'local-model',config:{context_length:32768,eval_batch_size:512}}]}]});}};};
    LF.Storage={getAiSettings:function(){return{provider:'lmstudio',endpoint:'http://127.0.0.1:1234/v1',model:'local-model'};},getApiKey:function(){return'';}};LF.AIProviders={lmstudio:{keyRequired:false}};
    try{const cap=await AI.resolveModelCapabilities({provider:'lmstudio',endpoint:'http://127.0.0.1:1234/v1',model:'local-model',force:true});assert(seen,'http://127.0.0.1:1234/api/v1/models','native models URL');assert(cap.loadedModel,'local-model','loaded model identity');assert(cap.contextWindow,32768,'loaded instance context wins over theoretical model max');assert(cap.modelMaxContextWindow,131072,'theoretical max retained separately');assert(cap.runtimeContextWindow,32768,'runtime context exposed');assert(cap.maxOutputTokens,null,'no fabricated output max');assert(cap.exactOutput,false,'context is not exact output');}
    finally{global.fetch=oldFetch;delete LF.Storage;delete LF.AIProviders;}
  };

  t['LM Studio capability detects a different actually loaded model'] = async function () {
    const oldFetch=global.fetch;global.fetch=async function(){return{ok:true,status:200,headers:{get:function(){return null;}},text:async function(){return JSON.stringify({models:[{key:'qwen/unavailable',max_context_length:65536,loaded_instances:[]},{key:'gemma/loaded',max_context_length:32768,loaded_instances:[{id:'gemma/loaded',config:{context_length:16384}}]}]});}};};
    LF.Storage={getAiSettings:function(){return{provider:'lmstudio',endpoint:'http://127.0.0.1:1234/v1',model:'qwen/unavailable'};},getApiKey:function(){return'';}};LF.AIProviders={lmstudio:{keyRequired:false}};
    try{const cap=await AI.resolveModelCapabilities({provider:'lmstudio',endpoint:'http://127.0.0.1:1234/v1',model:'qwen/unavailable',force:true});assert(cap.loadedModel,'gemma/loaded','active loaded model');assert(cap.runtimeContextWindow,16384,'active runtime context');}
    finally{global.fetch=oldFetch;delete LF.Storage;delete LF.AIProviders;}
  };

  t['Custom provider capability probe accepts explicit OpenAI-compatible model metadata'] = async function () {
    const oldFetch=global.fetch;let calls=0;global.fetch=async function(){calls++;return{ok:true,status:200,headers:{get:function(){return null;}},text:async function(){return JSON.stringify({data:[{id:'custom-model',max_output_tokens:24576,context_window:131072}]});}};};
    LF.Storage={getAiSettings:function(){return{provider:'custom',endpoint:'https://models.example/v1',model:'custom-model'};},getApiKey:function(){return'';}};LF.AIProviders={custom:{keyRequired:false}};
    try{const cap=await AI.resolveModelCapabilities({provider:'custom',endpoint:'https://models.example/v1',model:'custom-model',force:true});assert(cap.maxOutputTokens,24576,'custom output metadata');assert(cap.contextWindow,131072,'custom context metadata');assert(cap.exactOutput,true,'custom output exact');const cached=await AI.resolveModelCapabilities({provider:'custom',endpoint:'https://models.example/v1',model:'custom-model'});assert(calls,1,'Detect metadata reused without another request');assert(cached.maxOutputTokens,24576,'detected metadata remains available to Actions');}
    finally{global.fetch=oldFetch;delete LF.Storage;delete LF.AIProviders;}
  };

  t['LM Studio loopback fetch stays a plain direct request'] = async function () {
    const oldFetch=global.fetch,oldLocation=global.location;let seen=null;
    global.location={protocol:'http:',origin:'http://127.0.0.1:8000'};
    global.fetch=async function(url,opts){seen={url:url,opts:opts};return{ok:true,status:200,statusText:'OK',headers:{get:function(){return null;},forEach:function(){}},text:async function(){return JSON.stringify({id:'test',model:'local-model',choices:[{message:{content:'OK'},finish_reason:'stop'}]});}};};
    LF.PromptRegistry={promptText:function(){return'Reply OK';}};
    LF.Storage={getAiSettings:function(){return{provider:'lmstudio',endpoint:'http://127.0.0.1:1234/v1',model:'local-model',maxTokens:4096,inactivityTimeoutMs:60000,streaming:false};},getApiKey:function(){return'';}};
    LF.AIProviders={lmstudio:{keyRequired:false,tokenParam:'max_tokens',supportsStreaming:true,supportsTemperature:true,connectionTestTimeoutMs:60000,thinkingModes:{off:{reasoning_effort:'none',chat_template_kwargs:{enable_thinking:false}}}}};
    try{const result=await AI.testConnection();assert(result.ok,true,'connection result');assert(result.provider,'lmstudio','provider diagnostic');assert(result.finishReason,'stop','finish reason diagnostic');assert(Number.isFinite(result.requestElapsedMs),true,'successful request timing');assert(result.responseBytes>0,true,'response size diagnostic');assert(result.usage.estimated,true,'estimated usage marked');assert(result.httpRequests,1,'one HTTP request');assert(seen.url,'http://127.0.0.1:1234/v1/chat/completions','loopback URL');assert(Object.prototype.hasOwnProperty.call(seen.opts,'mode'),false,'no explicit fetch mode');const sent=JSON.parse(seen.opts.body);assert(Array.isArray(sent.messages),true,'messages array sent');assert(sent.messages[0].role,'user','connection test role');assert(sent.messages[0].content,'Reply OK','connection test content');assert(sent.max_tokens,16,'tiny probe budget');assert(sent.reasoning_effort,'none','connection probe disables reasoning');assert(sent.chat_template_kwargs.enable_thinking,false,'connection probe disables template thinking');}
    finally{global.fetch=oldFetch;if(oldLocation===undefined)delete global.location;else global.location=oldLocation;delete LF.PromptRegistry;delete LF.Storage;delete LF.AIProviders;}
  };

  t['LM Studio model discovery reads the OpenAI-compatible models endpoint'] = async function () {
    const oldFetch=global.fetch;let seen='';
    global.fetch=async function(url){seen=url;return{ok:true,status:200,headers:{get:function(){return null;}},text:async function(){return JSON.stringify({data:[{id:'qwen3-8b'},{id:'gemma-3-4b'}]});}};};
    LF.Storage={getAiSettings:function(){return{provider:'lmstudio',endpoint:'http://127.0.0.1:1234/v1',model:'local-model'};},getApiKey:function(){return'';}};
    LF.AIProviders={lmstudio:{keyRequired:false}};
    try{const result=await AI.listModels('lmstudio','http://127.0.0.1:1234/v1');assert(seen,'http://127.0.0.1:1234/v1/models','models URL');assert(result.models,['qwen3-8b','gemma-3-4b'],'model ids');}
    finally{global.fetch=oldFetch;delete LF.Storage;delete LF.AIProviders;}
  };

  t['NVIDIA discovery uses its declared authenticated catalogue and deduplicates model IDs'] = async function () {
    const oldFetch=global.fetch;let seen=null;
    global.fetch=async function(url,options){seen={url:url,authorization:options.headers.Authorization};return{ok:true,status:200,headers:{get:function(){return null;}},text:async function(){return JSON.stringify({data:[{id:'nvidia/zeta'},{id:'meta/alpha'},{id:'meta/alpha'}]});}};};
    LF.Storage={getAiSettings:function(){return{provider:'nvidia',endpoint:'https://wrong.example/v1',model:'meta/alpha'};},getApiKey:function(){return'nvapi-test';}};LF.AIProviders={nvidia:{keyRequired:true,modelsEndpoint:'https://integrate.api.nvidia.com/v1/models'}};
    try{const result=await AI.listModels('nvidia','https://wrong.example/v1','nvapi-test');assert(seen.url,'https://integrate.api.nvidia.com/v1/models','declared catalogue URL');assert(seen.authorization,'Bearer nvapi-test','bearer auth');assert(result.models,['nvidia/zeta','meta/alpha'],'unique IDs');}
    finally{global.fetch=oldFetch;delete LF.Storage;delete LF.AIProviders;}
  };


  t['LM Studio SSE context overflow is preserved as MODEL_CONTEXT_LENGTH, not CORS'] = async function () {
    const oldFetch=global.fetch,oldLocation=global.location;global.location={protocol:'file:',origin:'null'};
    const encoder=new TextEncoder(),payload='event: error\ndata: '+JSON.stringify({error:{message:'Engine protocol predict request returned 400: {\"error\":{\"code\":400,\"message\":\"request (37174 tokens) exceeds the available context size (32768 tokens), try increasing it\",\"type\":\"exceed_context_size_error\",\"n_prompt_tokens\":37174,\"n_ctx\":32768}}'}})+'\n\n';
    global.fetch=async function(){let done=false;return{ok:true,status:200,statusText:'OK',headers:{get:function(name){return name==='content-type'?'text/event-stream':null;},forEach:function(){}},body:{getReader:function(){return{read:async function(){if(done)return{done:true};done=true;return{done:false,value:encoder.encode(payload)};},cancel:async function(){}};}}};};
    LF.Storage={getAiSettings:function(){return{provider:'lmstudio',endpoint:'http://127.0.0.1:1234/v1',model:'local-model',inactivityTimeoutMs:60000,streaming:true};},getApiKey:function(){return'';}};LF.AIProviders={lmstudio:{id:'lmstudio',keyRequired:false,tokenParam:'max_tokens',supportsStreaming:true,supportsTemperature:true,rateLimit:{retries:0}}};
    try{const spec=AI.buildRequest({messages:[{role:'user',content:'large'}],stream:true,maxTokens:512,hardTimeoutMs:5000});let err=null;try{await AI.send(spec,{label:'analysis.enrich.enrich.response'});}catch(e){err=e;}assert(!!err,true,'context error raised');assert(err.code,'MODEL_CONTEXT_LENGTH','classified context code');assert(err.isNetwork===true,false,'not rewritten as network/CORS');assert(err.promptTokens,37174,'provider prompt token count');assert(err.contextWindow,32768,'provider context size');assert(/Model context exceeded/.test(err.message),true,'actionable message');}
    finally{global.fetch=oldFetch;if(oldLocation===undefined)delete global.location;else global.location=oldLocation;delete LF.Storage;delete LF.AIProviders;}
  };

  t['prompt estimator is conservative for JSON-heavy context preflight'] = function () {
    const text=JSON.stringify({rows:Array.from({length:100},function(_,i){return{id:i,value:'sample_'+i,detail:'measurement evidence'};})});
    assert(AI.estimatePromptTokens([{role:'user',content:text}])>AI.estimateTokens(text),true,'preflight estimate is more conservative than display estimate');
  };

  t['local providers never inherit a stored cloud API key'] = function () {
    LF.Storage = {
      getAiSettings: function () { return { provider: 'ollama', endpoint: 'http://127.0.0.1:11434/v1', model: 'gemma3', maxTokens: 512, inactivityTimeoutMs: 60000, streaming: false }; },
      getApiKey: function () { return 'stale-zai-key'; }
    };
    LF.AIProviders = { ollama: { keyRequired: false, tokenParam: 'max_tokens', supportsStreaming: true, supportsTemperature: true } };
    const spec = AI.buildRequest({ messages: [{ role: 'user', content: 'hi' }], stream: false });
    assert(Object.prototype.hasOwnProperty.call(spec.headers,'Authorization'), false, 'no stale auth header');
    delete LF.Storage; delete LF.AIProviders;
  };

  t['LM Studio structured Actions use JSON Schema response format'] = function () {
    LF.Storage = {
      getAiSettings: function () { return { provider: 'lmstudio', endpoint: 'http://127.0.0.1:1234/v1', model: 'local-model', temperature: 0.2, maxTokens: 4096, inactivityTimeoutMs: 180000, streaming: true }; },
      getApiKey: function () { return ''; }
    };
    LF.AIProviders = { lmstudio: { keyRequired: false, tokenParam: 'max_tokens', supportsStreaming: true, supportsTemperature: true, supportsJsonSchema: true } };
    const schema = { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } };
    const spec = AI.buildRequest({ messages: [{ role: 'user', content: 'json' }], jsonMode: true, jsonSchema: schema, jsonSchemaName: 'dataset_corrections' });
    assert(spec.body.response_format.type, 'json_schema', 'structured type');
    assert(spec.body.response_format.json_schema.name, 'dataset_corrections', 'schema name');
    assert(spec.body.response_format.json_schema.schema, schema, 'schema payload');
    delete LF.Storage; delete LF.AIProviders;
  };


  t['buildRequest rejects an empty Chat Completions messages array before fetch'] = function () {
    LF.Storage = {
      getAiSettings: function () { return { provider: 'ollama', endpoint: 'http://127.0.0.1:11434/v1', model: 'gemma3', inactivityTimeoutMs: 60000, streaming: false }; },
      getApiKey: function () { return ''; }
    };
    LF.AIProviders = { ollama: { keyRequired: false, tokenParam: 'max_tokens', supportsStreaming: true } };
    let message='';
    try { AI.buildRequest({ messages: [], stream: false }); } catch (err) { message=err.message; }
    assert(/at least one message/i.test(message), true, 'empty messages rejected locally');
    delete LF.Storage; delete LF.AIProviders;
  };

  t['buildRequest guards required provider config'] = function () {
    LF.Storage = { getAiSettings: function () { return { provider: 'zai', endpoint: '', model: '' }; }, getApiKey: function () { return ''; } };
    LF.AIProviders = { zai: { keyRequired: true } };
    let threw = false;
    try { AI.buildRequest({ messages: [] }); } catch (err) { threw = /not configured/.test(err.message); }
    assert(threw, true, 'missing config throws');
    delete LF.Storage; delete LF.AIProviders;
  };

  t['isBusy and abort are inert without an active request'] = function () {
    assert(AI.isBusy(), false, 'not busy');
    assert(AI.abort(), false, 'no-op abort');
  };


  t['provider rate policy respects explicit pacing and bounded rate-limit retries'] = function () {
    const policy=AI.ratePolicy({settings:{provider:'zai',model:'glm-4.7-flash'},provider:{id:'zai',rateLimit:{retries:2,delaysMs:[6000,15000],freeFlashMinIntervalMs:2500}},model:'glm-4.7-flash'});
    assert(policy.minIntervalMs,2500,'free Flash pacing');
    assert(policy.retries,2,'bounded transport retries');
    assert(policy.delaysMs,[6000,15000],'bounded backoff');
    assert(AI.isRateLimitError({providerCode:'1305'}),true,'provider code 1305');
    assert(AI.isRateLimitError({status:429}),true,'HTTP 429');
    assert(AI.isRateLimitError({providerCode:'1310'}),false,'quota exhaustion is distinct');
    assert(AI.ratePolicy({settings:{provider:'custom',model:'x'},provider:{},model:'x'}).retries,1,'default transport retry is finite');
  };

  t['Retry-After parsing supports seconds and HTTP dates'] = function () {
    const seconds={get:function(name){return name==='retry-after'?'2':'';}};
    assert(AI.retryAfterMs(seconds),2000,'seconds retry-after');
    const future=new Date(Date.now()+4000).toUTCString(),dated={get:function(name){return name==='retry-after'?future:'';}};
    const parsed=AI.retryAfterMs(dated);
    assert(parsed>=2500&&parsed<=4500,true,'date retry-after');
  };

  t['connection test reports Z.AI rate limiting immediately without retry or pacing'] = async function () {
    const oldFetch=global.fetch,oldLocation=global.location;let calls=0,seenBody=null,progress=[];
    global.location={protocol:'https:',origin:'https://labflow.test'};
    global.fetch=async function(url,opts){calls++;seenBody=JSON.parse(opts.body);return{ok:false,status:429,statusText:'Too Many Requests',headers:{get:function(name){return name==='retry-after'?'15':null;},forEach:function(){}},text:async function(){return JSON.stringify({error:{code:1305,message:'slow down'}});}};};
    LF.PromptRegistry={promptText:function(){return'Reply only OK';}};
    LF.Storage={getAiSettings:function(){return{provider:'zai',endpoint:'https://api.z.ai/api/paas/v4',model:'glm-4.7-flash',temperature:0,inactivityTimeoutMs:60000,streaming:false};},getApiKey:function(){return'key';}};
    LF.AIProviders={zai:{id:'zai',keyRequired:true,tokenParam:'max_tokens',supportsStreaming:true,supportsTemperature:true,thinkingModes:{off:{thinking:{type:'disabled'}}},connectionTestTimeoutMs:15000,rateLimit:{retries:2,delaysMs:[6000,15000],maxDelayMs:30000,freeFlashMinIntervalMs:2500}}};
    try{const out=await AI.testConnection({onProgress:function(p){progress.push(p);}});assert(out.ok,false,'rate limit is not connection OK');assert(out.reachable,true,'provider reachability reported');assert(out.rateLimited,true,'rate limit result');assert(calls,1,'single HTTP request');assert(out.rateLimitRetries,0,'no retries');assert(progress.some(function(p){return p.transportState==='provider_pacing'||p.transportState==='rate_limit_wait';}),false,'no pacing or backoff progress');assert(seenBody.max_tokens,16,'tiny token budget');assert(seenBody.thinking,{type:'disabled'},'Z.AI thinking disabled');assert(seenBody.model,'glm-4.7-flash','selected model unchanged');}
    finally{global.fetch=oldFetch;if(oldLocation===undefined)delete global.location;else global.location=oldLocation;delete LF.PromptRegistry;delete LF.Storage;delete LF.AIProviders;}
  };

  t['transport retries the identical request once after Z.AI 1305 and then succeeds'] = async function () {
    const oldFetch=global.fetch,oldLocation=global.location,oldSetTimeout=global.setTimeout;let calls=0,bodies=[];
    global.location={protocol:'https:',origin:'https://labflow.test'};
    global.setTimeout=function(fn,ms){return oldSetTimeout(fn,Math.min(Number(ms)||0,2));};
    global.fetch=async function(url,opts){
      calls++;bodies.push(opts.body);
      if(calls===1)return{ok:false,status:429,statusText:'Too Many Requests',headers:{get:function(name){if(name==='retry-after')return'0';return null;},forEach:function(){}},text:async function(){return JSON.stringify({error:{code:1305,message:'The API has triggered a rate limit.'}});}};
      return{ok:true,status:200,statusText:'OK',headers:{get:function(){return null;},forEach:function(){}},text:async function(){return JSON.stringify({id:'ok',model:'glm-test',choices:[{message:{content:'done'},finish_reason:'stop'}],usage:{prompt_tokens:4,completion_tokens:2,total_tokens:6}});}};
    };
    LF.Storage={getAiSettings:function(){return{provider:'zai',endpoint:'https://api.z.ai/api/paas/v4',model:'glm-test',temperature:0.2,inactivityTimeoutMs:60000,streaming:false};},getApiKey:function(){return'key';}};
    LF.AIProviders={zai:{id:'zai',keyRequired:true,tokenParam:'max_tokens',supportsStreaming:true,supportsTemperature:true,rateLimit:{retries:1,delaysMs:[1],maxDelayMs:10,minIntervalMs:0}}};
    try{
      const spec=AI.buildRequest({messages:[{role:'user',content:'same request'}],stream:false,maxTokens:128,hardTimeoutMs:5000});
      const out=await AI.send(spec,{label:'rate-test'});
      assert(out.content,'done','eventual success');
      assert(calls,2,'two HTTP attempts');
      assert(bodies[0],bodies[1],'identical request body');
      assert(out.rateLimitRetries,1,'transport retry count');
    }finally{global.fetch=oldFetch;global.setTimeout=oldSetTimeout;if(oldLocation===undefined)delete global.location;else global.location=oldLocation;delete LF.Storage;delete LF.AIProviders;}
  };

  return t;
};
