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

  t['buildRequest honors jsonMode and disables thinking'] = function () {
    LF.Storage = {
      getAiSettings: function () { return { provider: 'ollama', endpoint: 'http://127.0.0.1:11434/v1', model: 'gemma3', temperature: 0.2, maxTokens: 512, inactivityTimeoutMs: 60000, streaming: false }; },
      getApiKey: function () { return ''; }
    };
    LF.AIProviders = { ollama: { keyRequired: false, tokenParam: 'max_tokens', supportsStreaming: true, supportsTemperature: true, supportsJsonMode: true, supportsThinking: true, reasoningEffort: 'none' } };
    const spec = AI.buildRequest({ provider: 'ollama', messages: [{ role: 'user', content: 'j' }], stream: false, jsonMode: true });
    assert(spec.body.response_format, { type: 'json_object' }, 'json mode');
    assert(spec.body.thinking, { type: 'disabled' }, 'thinking disabled');
    assert(spec.body.stream, false, 'stream false honored');
    assert(spec.body.reasoning_effort, 'none', 'reasoning effort');
    delete LF.Storage; delete LF.AIProviders;
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
    assert(AI.resolveOutputBudget({contextWindow:8192},0,0,2000),5936,'context ceiling subtracts input and reserve');
    assert(AI.resolveOutputBudget({},0,0,1000),null,'unknown remains provider default');
  };

  t['Gemini capability probe reads outputTokenLimit from the native Models API'] = async function () {
    const oldFetch=global.fetch;let seen='';global.fetch=async function(url){seen=url;return{ok:true,status:200,headers:{get:function(){return null;}},text:async function(){return JSON.stringify({name:'models/gemini-test',inputTokenLimit:1000000,outputTokenLimit:65536});}};};
    LF.Storage={getAiSettings:function(){return{provider:'gemini',endpoint:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',model:'gemini-test'};},getApiKey:function(){return'key';}};LF.AIProviders={gemini:{keyRequired:true}};
    try{const cap=await AI.resolveModelCapabilities({provider:'gemini',endpoint:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',model:'gemini-test',apiKey:'key',force:true});assert(/v1beta\/models\/gemini-test/.test(seen),true,'native model endpoint');assert(cap.maxOutputTokens,65536,'output limit');assert(cap.contextWindow,1000000,'input/context limit');}
    finally{global.fetch=oldFetch;delete LF.Storage;delete LF.AIProviders;}
  };


  t['Ollama capability probe reads num_predict and model context'] = async function () {
    const oldFetch=global.fetch;let seen={};global.fetch=async function(url,opts){seen={url:url,body:JSON.parse(opts.body)};return{ok:true,status:200,headers:{get:function(){return null;}},text:async function(){return JSON.stringify({parameters:'temperature 0.2\nnum_predict 12288',model_info:{'qwen.context_length':65536}});}};};
    LF.Storage={getAiSettings:function(){return{provider:'ollama',endpoint:'http://127.0.0.1:11434/v1',model:'qwen-test'};},getApiKey:function(){return'';}};LF.AIProviders={ollama:{keyRequired:false}};
    try{const cap=await AI.resolveModelCapabilities({provider:'ollama',endpoint:'http://127.0.0.1:11434/v1',model:'qwen-test',force:true});assert(seen.url,'http://127.0.0.1:11434/api/show','native show URL');assert(seen.body.model,'qwen-test','show model');assert(cap.maxOutputTokens,12288,'num_predict');assert(cap.contextWindow,65536,'model context');assert(cap.exactOutput,true,'explicit output limit');}
    finally{global.fetch=oldFetch;delete LF.Storage;delete LF.AIProviders;}
  };

  t['LM Studio capability probe reads loaded context without inventing output max'] = async function () {
    const oldFetch=global.fetch;let seen='';global.fetch=async function(url){seen=url;return{ok:true,status:200,headers:{get:function(){return null;}},text:async function(){return JSON.stringify({models:[{id:'local-model',max_context_length:32768,loaded_instances:[{id:'local-model:1',context_length:16384}]}]});}};};
    LF.Storage={getAiSettings:function(){return{provider:'lmstudio',endpoint:'http://127.0.0.1:1234/v1',model:'local-model'};},getApiKey:function(){return'';}};LF.AIProviders={lmstudio:{keyRequired:false}};
    try{const cap=await AI.resolveModelCapabilities({provider:'lmstudio',endpoint:'http://127.0.0.1:1234/v1',model:'local-model',force:true});assert(seen,'http://127.0.0.1:1234/api/v1/models','native models URL');assert(cap.contextWindow,16384,'loaded context wins');assert(cap.maxOutputTokens,null,'no fabricated output max');assert(cap.exactOutput,false,'context is not exact output');}
    finally{global.fetch=oldFetch;delete LF.Storage;delete LF.AIProviders;}
  };

  t['Custom provider capability probe accepts explicit OpenAI-compatible model metadata'] = async function () {
    const oldFetch=global.fetch;global.fetch=async function(){return{ok:true,status:200,headers:{get:function(){return null;}},text:async function(){return JSON.stringify({data:[{id:'custom-model',max_output_tokens:24576,context_window:131072}]});}};};
    LF.Storage={getAiSettings:function(){return{provider:'custom',endpoint:'https://models.example/v1',model:'custom-model'};},getApiKey:function(){return'';}};LF.AIProviders={custom:{keyRequired:false}};
    try{const cap=await AI.resolveModelCapabilities({provider:'custom',endpoint:'https://models.example/v1',model:'custom-model',force:true});assert(cap.maxOutputTokens,24576,'custom output metadata');assert(cap.contextWindow,131072,'custom context metadata');assert(cap.exactOutput,true,'custom output exact');}
    finally{global.fetch=oldFetch;delete LF.Storage;delete LF.AIProviders;}
  };

  t['LM Studio loopback fetch stays a plain direct request'] = async function () {
    const oldFetch=global.fetch,oldLocation=global.location;let seen=null;
    global.location={protocol:'http:',origin:'http://127.0.0.1:8000'};
    global.fetch=async function(url,opts){seen={url:url,opts:opts};return{ok:true,status:200,statusText:'OK',headers:{get:function(){return null;},forEach:function(){}},text:async function(){return JSON.stringify({id:'test',model:'local-model',choices:[{message:{content:'OK'},finish_reason:'stop'}]});}};};
    LF.PromptRegistry={promptText:function(){return'Reply OK';}};
    LF.Storage={getAiSettings:function(){return{provider:'lmstudio',endpoint:'http://127.0.0.1:1234/v1',model:'local-model',maxTokens:4096,inactivityTimeoutMs:60000,streaming:false};},getApiKey:function(){return'';}};
    LF.AIProviders={lmstudio:{keyRequired:false,tokenParam:'max_tokens',supportsStreaming:true,supportsTemperature:true,connectionTestTimeoutMs:60000}};
    try{const result=await AI.testConnection();assert(result.ok,true,'connection result');assert(seen.url,'http://127.0.0.1:1234/v1/chat/completions','loopback URL');assert(Object.prototype.hasOwnProperty.call(seen.opts,'mode'),false,'no explicit fetch mode');const sent=JSON.parse(seen.opts.body);assert(Array.isArray(sent.messages),true,'messages array sent');assert(sent.messages[0].role,'user','connection test role');assert(!!sent.messages[0].content,true,'connection test content');}
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

  return t;
};
