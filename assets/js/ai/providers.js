(function () {
  'use strict';
  /* Provider capabilities are declarative transport metadata. Provider-specific
     request fields belong here, never in Actions or scientific prompts. A
     thinkingModes entry is applied only after the Action/global policy has been
     reconciled with model capability; `auto` deliberately sends no override. */
  const LF = window.LabFlow = window.LabFlow || {};
  LF.AIProviders = {
    zai: {
      id:'zai', name:'Z.AI', endpoint:'https://api.z.ai/api/paas/v4/chat/completions', model:'glm-4.7-flash', keyRequired:true, modelSelect:true, remoteModelMetadata:false, staticModelCatalogue:true, modelSelectLabel:'Z.AI model', supportsJsonMode:true, supportsStreaming:false, tokenParam:'max_tokens', supportsTemperature:true, thinkingModes:{off:{thinking:{type:'disabled'}},on:{thinking:{type:'enabled'}}}, connectionTestTimeoutMs:90000, connectionTestMaxTokens:128, requestDeadlineMs:180000, knownModels:['glm-4.7-flash','glm-5.3','glm-5.2','glm-5.1','glm-5','glm-4.7','glm-4.7-flashx','glm-4.6','glm-4.5','glm-4.5-air','glm-4.5-x','glm-4.5-airx','glm-4.5-flash','glm-4-32b-0414-128k'],
      note:'Z.AI uses the official General API Chat Completions endpoint directly from the browser. LabFlow sends no relay-specific headers and uses non-streaming requests for this provider to keep the browser path predictable. If the browser blocks the cross-origin request, LabFlow reports a single CORS/network diagnostic instead of retrying or requiring a custom local server.'
    },
    openrouter: {
      id:'openrouter', name:'OpenRouter', endpoint:'https://openrouter.ai/api/v1/chat/completions', modelsEndpoint:'https://openrouter.ai/api/v1/models', model:'openrouter/free', keyRequired:true, modelSelect:true, modelSelectLabel:'OpenRouter model', supportsJsonMode:true, supportsStreaming:true, supportsStreamUsage:true, tokenParam:'max_tokens', supportsTemperature:true, thinkingModes:{off:{reasoning:{effort:'none'}},on:{reasoning:{effort:'medium'}}}, headers:{'X-OpenRouter-Title':'LabFlow'}, connectionTestTimeoutMs:45000,
      note:'OpenRouter OpenAI-compatible endpoint. Use an OpenRouter model slug; Detect reads the current catalogue and model limits.'
    },
    nvidia: {
      id:'nvidia', name:'NVIDIA NIM', endpoint:'https://integrate.api.nvidia.com/v1/chat/completions', modelsEndpoint:'https://integrate.api.nvidia.com/v1/models', model:'nvidia/nemotron-3.5-lightning-30b-a3b', keyRequired:true, modelSelect:true, modelSelectLabel:'NVIDIA NIM model', supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, connectionTestTimeoutMs:60000,
      note:'NVIDIA hosted NIM OpenAI-compatible endpoint. Enter the NVIDIA API key, load its current model catalogue, then choose the exact model ID before testing.'
    },
    openai: {
      id:'openai', name:'OpenAI', endpoint:'https://api.openai.com/v1/chat/completions', model:'gpt-5-mini', keyRequired:true, supportsStreaming:true, supportsStreamUsage:true, tokenParam:'max_completion_tokens', supportsTemperature:false, thinkingModes:{off:{reasoning_effort:'none'},on:{reasoning_effort:'medium'}},
      note:'OpenAI Chat Completions compatible endpoint.'
    },
    gemini: {
      id:'gemini', name:'Google Gemini', endpoint:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model:'gemini-3.7-flash', keyRequired:true, supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true,
      note:'Gemini OpenAI-compatibility endpoint.'
    },
    ollama: {
      id:'ollama', name:'Ollama (local)', local:true, endpoint:'http://127.0.0.1:11434/v1', model:'gemma3', keyRequired:false, modelSelect:true, modelSelectLabel:'Ollama model', supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, supportsJsonMode:true, thinkingPromptGuard:true, thinkingModes:{off:{reasoning_effort:'none'},on:{reasoning_effort:'medium'}}, requestTimeoutMs:300000, connectionTestTimeoutMs:15000,
      note:'Local OpenAI-compatible endpoint. Detect reads installed models from /api/tags and running models from /api/ps; when exactly one model is running it becomes the selected model. LabFlow resolves the base URL to /v1/chat/completions. The provider must allow the page origin.'
    },
    lmstudio: {
      id:'lmstudio', name:'LM Studio (local)', local:true, endpoint:'http://127.0.0.1:1234/v1', model:'local-model', keyRequired:false, optionalKey:true, modelSelect:true, modelSelectLabel:'LM Studio model', supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, supportsJsonMode:true, supportsJsonSchema:true, jsonSchemaStrict:false, thinkingPromptGuard:true, thinkingModes:{off:{reasoning_effort:'none',chat_template_kwargs:{enable_thinking:false,reasoning_effort:'none'}},on:{reasoning_effort:'medium',chat_template_kwargs:{enable_thinking:true,reasoning_effort:'medium'}}}, requestTimeoutMs:300000, connectionTestTimeoutMs:15000,
      note:'Local OpenAI-compatible endpoint. Detect reads LM Studio /api/v1/models first, selects the only loaded LLM when exactly one is running, and falls back to /v1/models only when the native metadata endpoint is unavailable. An optional LM Studio API token can be stored for this provider. The server must allow the current browser origin.'
    },
    llamacpp: {
      id:'llamacpp', name:'llama.cpp (local)', local:true, endpoint:'http://127.0.0.1:8080/v1', model:'local-model', keyRequired:false, optionalKey:true, modelSelect:true, modelSelectLabel:'llama.cpp model', supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, supportsJsonMode:true, requestTimeoutMs:300000, connectionTestTimeoutMs:15000, connectionTestMaxTokens:64, connectionTestAcceptReasoningOnly:true, safeThinkingOverrideWhenUnknown:true, supportsReasoningControl:true, thinkingPromptGuard:true, recommendedRuntime:{parallelSlots:1,contextWindow:65536}, thinkingModes:{off:{reasoning_effort:'none',chat_template_kwargs:{enable_thinking:false,reasoning_effort:'none'}},on:{reasoning_effort:'medium',chat_template_kwargs:{enable_thinking:true,reasoning_effort:'medium'}}},
      note:'Local llama-server OpenAI-compatible endpoint. LabFlow resolves the base URL to /v1/chat/completions and discovers served model IDs from /v1/models. An optional llama-server API key can be stored for this provider. The LabFlow runtime profile is one llama-server slot (--parallel 1) with a 65,536-token context (-c 65536); Detect reads the effective per-slot n_ctx and total_slots from /props and reports any mismatch instead of silently dividing or inventing context. llama.cpp model metadata may not expose whether a model reasons, so LabFlow can still apply the server-supported per-request reasoning controls declared here; reasoning-off Actions and the connection probe request thinking-off with reasoning_effort and chat_template_kwargs; Actions also use a final-only prompt guard, and streamed llama.cpp requests can terminate a reasoning block at runtime when a template ignores the static override. Some model templates may still emit reasoning; therefore the connection probe treats a valid HTTP 200 reasoning-only Chat Completions response as reachable but inconclusive for final text, while normal Actions remain strict. Structured JSON is still validated locally by LabFlow.'
    },
    custom: {
      id:'custom', name:'Custom OpenAI-compatible', endpoint:'', model:'', keyRequired:false, optionalKey:true, supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true,
      note:'Set endpoint and model manually.'
    }
  };
  LF.AIProviderList = Object.keys(LF.AIProviders).map(function(id){return LF.AIProviders[id];});
  if(LF.Logger) LF.Logger.info('providers','registry.ready',{defaultProvider:'zai',defaultModel:'glm-4.7-flash',providers:LF.AIProviderList.map(function(p){return{id:p.id,name:p.name,model:p.model,endpoint:p.endpoint,keyRequired:p.keyRequired};})});
}());
