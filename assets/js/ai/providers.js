(function () {
  'use strict';
  /* Provider capabilities are declarative transport metadata. Provider-specific
     request fields belong here, never in Actions or scientific prompts. A
     thinkingModes entry is applied only after the Action/global policy has been
     reconciled with model capability; `auto` deliberately sends no override. */
  const LF = window.LabFlow = window.LabFlow || {};
  LF.AIProviders = {
    zai: {
      id:'zai', name:'Z.AI', endpoint:'https://api.z.ai/api/paas/v4/chat/completions', model:'glm-4.7-flash', keyRequired:true, modelSelect:false, skipModelCatalogue:true, preserveConfiguredModel:true, modelSelectLabel:'Z.AI model', supportsJsonMode:true, supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, thinkingModes:{off:{thinking:{type:'disabled'}},on:{thinking:{type:'enabled'}}}, headers:{'Accept-Language':'en-US,en'}, connectionTestTimeoutMs:15000, requestDeadlineMs:180000, rateLimit:{retries:0, baseDelayMs:2000, maxDelayMs:15000},
      note:'Official general Z.AI Chat Completions endpoint. Coding Plan keys use a separate endpoint intended for supported coding tools and are not general API keys. The configured Z.AI model ID is used exactly as entered; Detect intentionally does not import the provider-wide catalogue. Provider throttles and quota errors are surfaced immediately; LabFlow does not add hidden Z.AI retry traffic or local cooldown state. Connection test keeps a single attempt.'
    },
    openrouter: {
      id:'openrouter', name:'OpenRouter', endpoint:'https://openrouter.ai/api/v1/chat/completions', model:'openai/gpt-5-mini', keyRequired:true, supportsJsonMode:true, supportsStreaming:true, supportsStreamUsage:true, tokenParam:'max_tokens', supportsTemperature:true, thinkingModes:{off:{reasoning:{effort:'none'}},on:{reasoning:{effort:'medium'}}}, headers:{'X-OpenRouter-Title':'LabFlow'}, rateLimit:{retries:2, baseDelayMs:1500, maxDelayMs:12000},
      note:'OpenRouter OpenAI-compatible endpoint. Use an OpenRouter model slug; Detect reads the current catalogue and model limits.'
    },
    nvidia: {
      id:'nvidia', name:'NVIDIA NIM', endpoint:'https://integrate.api.nvidia.com/v1/chat/completions', modelsEndpoint:'https://integrate.api.nvidia.com/v1/models', model:'meta/llama-3.3-70b-instruct', keyRequired:true, modelSelect:true, modelSelectLabel:'NVIDIA NIM model', supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, rateLimit:{retries:1, baseDelayMs:1500, maxDelayMs:10000},
      note:'NVIDIA hosted NIM OpenAI-compatible endpoint. Enter the NVIDIA API key, load its current model catalogue, then choose the exact model ID before testing.'
    },
    openai: {
      id:'openai', name:'OpenAI', endpoint:'https://api.openai.com/v1/chat/completions', model:'gpt-5-mini', keyRequired:true, supportsStreaming:true, supportsStreamUsage:true, tokenParam:'max_completion_tokens', supportsTemperature:false, thinkingModes:{off:{reasoning_effort:'none'},on:{reasoning_effort:'medium'}}, rateLimit:{retries:2, baseDelayMs:1500, maxDelayMs:12000},
      note:'OpenAI Chat Completions compatible endpoint.'
    },
    gemini: {
      id:'gemini', name:'Google Gemini', endpoint:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model:'gemini-3.7-flash', keyRequired:true, supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, rateLimit:{retries:2, baseDelayMs:1500, maxDelayMs:12000},
      note:'Gemini OpenAI-compatibility endpoint.'
    },
    ollama: {
      id:'ollama', name:'Ollama (local)', endpoint:'http://127.0.0.1:11434/v1', model:'gemma3', keyRequired:false, modelSelect:true, modelSelectLabel:'Ollama model', supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, supportsJsonMode:true, thinkingModes:{off:{reasoning_effort:'none'},on:{reasoning_effort:'medium'}}, requestTimeoutMs:300000, connectionTestTimeoutMs:15000,
      note:'Local OpenAI-compatible endpoint. Detect reads installed models from /api/tags and running models from /api/ps; when exactly one model is running it becomes the selected model. LabFlow resolves the base URL to /v1/chat/completions. The provider must allow the page origin.'
    },
    lmstudio: {
      id:'lmstudio', name:'LM Studio (local)', endpoint:'http://127.0.0.1:1234/v1', model:'local-model', keyRequired:false, optionalKey:true, modelSelect:true, modelSelectLabel:'LM Studio model', supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, supportsJsonSchema:true, thinkingModes:{off:{reasoning_effort:'none',chat_template_kwargs:{enable_thinking:false}},on:{reasoning_effort:'medium',chat_template_kwargs:{enable_thinking:true}}}, requestTimeoutMs:300000, connectionTestTimeoutMs:15000,
      note:'Local OpenAI-compatible endpoint. Detect reads LM Studio /api/v1/models first, selects the only loaded LLM when exactly one is running, and falls back to /v1/models only when the native metadata endpoint is unavailable. An optional LM Studio API token can be stored for this provider. The server must allow the current browser origin.'
    },
    llamacpp: {
      id:'llamacpp', name:'llama.cpp (local)', endpoint:'http://127.0.0.1:8080/v1', model:'local-model', keyRequired:false, optionalKey:true, modelSelect:true, modelSelectLabel:'llama.cpp model', supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, supportsJsonMode:true, requestTimeoutMs:300000, connectionTestTimeoutMs:15000, connectionTestMaxTokens:64, connectionTestAcceptReasoningOnly:true, safeThinkingOverrideWhenUnknown:true, recommendedRuntime:{parallelSlots:1,contextWindow:65536}, thinkingModes:{off:{reasoning_effort:'none',reasoning_budget:0,chat_template_kwargs:{enable_thinking:false}},on:{reasoning_effort:'medium',chat_template_kwargs:{enable_thinking:true}}},
      note:'Local llama-server OpenAI-compatible endpoint. LabFlow resolves the base URL to /v1/chat/completions and discovers served model IDs from /v1/models. An optional llama-server API key can be stored for this provider. The LabFlow runtime profile is one llama-server slot (--parallel 1) with a 65,536-token context (-c 65536); Detect reads the effective per-slot n_ctx and total_slots from /props and reports any mismatch instead of silently dividing or inventing context. llama.cpp model metadata may not expose whether a model reasons, so LabFlow can still apply the server-supported per-request reasoning controls declared here; reasoning-off Actions and the connection probe request thinking-off with reasoning_effort, reasoning_budget and chat_template_kwargs. Some model templates may still emit reasoning; therefore the connection probe treats a valid HTTP 200 reasoning-only Chat Completions response as reachable but inconclusive for final text, while normal Actions remain strict. Structured JSON is still validated locally by LabFlow.'
    },
    custom: {
      id:'custom', name:'Custom OpenAI-compatible', endpoint:'', model:'', keyRequired:false, optionalKey:true, supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true,
      note:'Set endpoint and model manually.'
    }
  };
  LF.AIProviderList = Object.keys(LF.AIProviders).map(function(id){return LF.AIProviders[id];});
  if(LF.Logger) LF.Logger.info('providers','registry.ready',{defaultProvider:'zai',defaultModel:'glm-4.7-flash',providers:LF.AIProviderList.map(function(p){return{id:p.id,name:p.name,model:p.model,endpoint:p.endpoint,keyRequired:p.keyRequired};})});
}());
