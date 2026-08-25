(function () {
  'use strict';
  /* Provider capabilities are declarative transport metadata. Provider-specific
     request fields belong here, never in Actions or scientific prompts. A
     thinkingModes entry is applied only after the Action/global policy has been
     reconciled with model capability; `auto` deliberately sends no override. */
  const LF = window.LabFlow = window.LabFlow || {};
  LF.AIProviders = {
    zai: {
      id:'zai', name:'Z.AI', endpoint:'https://api.z.ai/api/paas/v4/chat/completions', model:'glm-4.7-flash', keyRequired:true, modelSelect:false, skipModelCatalogue:true, preserveConfiguredModel:true, modelSelectLabel:'Z.AI model', supportsJsonMode:true, supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, thinkingModes:{off:{thinking:{type:'disabled'}},on:{thinking:{type:'enabled'}}}, headers:{'Accept-Language':'en-US,en'}, connectionTestTimeoutMs:15000, rateLimit:{retries:3,delaysMs:[2500,7000,15000],maxDelayMs:60000,freeFlashMinIntervalMs:0,adaptiveStepMs:1500,adaptiveMaxIntervalMs:8000},
      note:'Official general Z.AI Chat Completions endpoint. Coding Plan keys use a separate endpoint intended for supported coding tools and are not general API keys. The configured Z.AI model ID is used exactly as entered; Detect intentionally does not import the provider-wide catalogue. HTTP 429 / code 1305 enables adaptive pacing and bounded backoff for normal Actions.'
    },
    openrouter: {
      id:'openrouter', name:'OpenRouter', endpoint:'https://openrouter.ai/api/v1/chat/completions', model:'openai/gpt-5-mini', keyRequired:true, supportsJsonMode:true, supportsStreaming:true, supportsStreamUsage:true, tokenParam:'max_tokens', supportsTemperature:true, thinkingModes:{off:{reasoning:{effort:'none'}},on:{reasoning:{effort:'medium'}}}, headers:{'X-OpenRouter-Title':'LabFlow'},
      note:'OpenRouter OpenAI-compatible endpoint. Use an OpenRouter model slug; Detect reads the current catalogue and model limits.'
    },
    nvidia: {
      id:'nvidia', name:'NVIDIA NIM', endpoint:'https://integrate.api.nvidia.com/v1/chat/completions', modelsEndpoint:'https://integrate.api.nvidia.com/v1/models', model:'meta/llama-3.3-70b-instruct', keyRequired:true, modelSelect:true, modelSelectLabel:'NVIDIA NIM model', supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true,
      note:'NVIDIA hosted NIM OpenAI-compatible endpoint. Enter the NVIDIA API key, load its current model catalogue, then choose the exact model ID before testing.'
    },
    openai: {
      id:'openai', name:'OpenAI', endpoint:'https://api.openai.com/v1/chat/completions', model:'gpt-5-mini', keyRequired:true, supportsStreaming:true, supportsStreamUsage:true, tokenParam:'max_completion_tokens', supportsTemperature:false, thinkingModes:{off:{reasoning_effort:'none'},on:{reasoning_effort:'medium'}},
      note:'OpenAI Chat Completions compatible endpoint.'
    },
    gemini: {
      id:'gemini', name:'Google Gemini', endpoint:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model:'gemini-3.6-flash', keyRequired:true, supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true,
      note:'Gemini OpenAI-compatibility endpoint.'
    },
    ollama: {
      id:'ollama', name:'Ollama (local)', endpoint:'http://127.0.0.1:11434/v1', model:'gemma3', keyRequired:false, supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, supportsJsonMode:true, thinkingModes:{off:{reasoning_effort:'none'},on:{reasoning_effort:'medium'}}, requestTimeoutMs:180000, connectionTestTimeoutMs:15000,
      note:'Local OpenAI-compatible endpoint. LabFlow resolves the base URL to /v1/chat/completions. When opened in a browser, the provider must allow the page origin.'
    },
    lmstudio: {
      id:'lmstudio', name:'LM Studio (local)', endpoint:'http://127.0.0.1:1234/v1', model:'local-model', keyRequired:false, supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, supportsJsonSchema:true, thinkingModes:{off:{reasoning_effort:'none',chat_template_kwargs:{enable_thinking:false}},on:{reasoning_effort:'medium',chat_template_kwargs:{enable_thinking:true}}}, requestTimeoutMs:180000, connectionTestTimeoutMs:15000,
      note:'Local OpenAI-compatible endpoint. LabFlow resolves the base URL to /v1/chat/completions and never reuses a cloud API key. LM Studio must be started with CORS enabled for direct browser access.'
    },
    custom: {
      id:'custom', name:'Custom OpenAI-compatible', endpoint:'', model:'', keyRequired:false, optionalKey:true, supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true,
      note:'Set endpoint and model manually.'
    }
  };
  LF.AIProviderList = Object.keys(LF.AIProviders).map(function(id){return LF.AIProviders[id];});
  if(LF.Logger) LF.Logger.info('providers','registry.ready',{defaultProvider:'zai',defaultModel:'glm-4.7-flash',providers:LF.AIProviderList.map(function(p){return{id:p.id,name:p.name,model:p.model,endpoint:p.endpoint,keyRequired:p.keyRequired};})});
}());
