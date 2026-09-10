(function () {
  'use strict';
  /* Provider capabilities are declarative transport metadata. Provider-specific
     request fields belong here, never in Actions or scientific prompts. A
     thinkingModes entry is applied only after the Action/global policy has been
     reconciled with model capability; `auto` deliberately sends no override. */
  const LF = window.LabFlow = window.LabFlow || {};
  LF.AIProviders = {
    zai: {
      id:'zai', name:'Z.AI', endpoint:'https://api.z.ai/api/paas/v4/chat/completions', model:'glm-4.7-flash', keyRequired:true, modelSelect:true, remoteModelMetadata:false, staticModelCatalogue:true, modelCatalogueRequired:true, modelSelectLabel:'Z.AI model', supportsJsonMode:true, supportsStreaming:false, tokenParam:'max_tokens', supportsTemperature:true, thinkingModes:{off:{thinking:{type:'disabled'}},on:{thinking:{type:'enabled'}}}, connectionTestTimeoutMs:90000, connectionTestMaxTokens:128, requestDeadlineMs:180000, knownModels:['glm-4.7-flash','glm-5.3','glm-5.2','glm-5.1','glm-5','glm-4.7','glm-4.7-flashx','glm-4.6','glm-4.5','glm-4.5-air','glm-4.5-x','glm-4.5-airx','glm-4.5-flash','glm-4-32b-0414-128k'],
      note:'Z.AI General API via direct browser Chat Completions.'
    },
    openrouter: {
      id:'openrouter', name:'OpenRouter', endpoint:'https://openrouter.ai/api/v1/chat/completions', model:'openrouter/free', keyRequired:true, modelSelect:true, modelCatalogueRequired:true, modelSelectLabel:'OpenRouter model', supportsJsonMode:true, supportsStreaming:true, supportsStreamUsage:true, tokenParam:'max_tokens', supportsTemperature:true, thinkingModes:{off:{reasoning:{effort:'none'}},on:{reasoning:{effort:'medium'}}}, headers:{'X-OpenRouter-Title':'LabFlow'}, connectionTestTimeoutMs:45000,
      note:'OpenRouter OpenAI-compatible endpoint.'
    },
    nvidia: {
      id:'nvidia', name:'NVIDIA NIM', endpoint:'https://integrate.api.nvidia.com/v1/chat/completions', model:'nvidia/nemotron-3.5-lightning-30b-a3b', keyRequired:true, modelSelect:true, modelCatalogueRequired:true, modelSelectLabel:'NVIDIA NIM model', supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, connectionTestTimeoutMs:60000,
      note:'NVIDIA hosted NIM OpenAI-compatible endpoint.'
    },
    openai: {
      id:'openai', name:'OpenAI', endpoint:'https://api.openai.com/v1/chat/completions', model:'gpt-5-mini', keyRequired:true, modelSelect:true, modelCatalogueRequired:true, modelSelectLabel:'OpenAI model', supportsStreaming:true, supportsStreamUsage:true, tokenParam:'max_completion_tokens', supportsTemperature:false, thinkingModes:{off:{reasoning_effort:'none'},on:{reasoning_effort:'medium'}},
      note:'OpenAI Chat Completions endpoint.'
    },
    gemini: {
      id:'gemini', name:'Google Gemini', endpoint:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model:'gemini-3.7-flash', keyRequired:true, modelSelect:true, modelCatalogueRequired:true, modelSelectLabel:'Google Gemini model', supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true,
      note:'Gemini OpenAI-compatible endpoint.'
    },
    ollama: {
      id:'ollama', name:'Ollama', local:true, endpoint:'http://127.0.0.1:11434/v1', model:'gemma3', keyRequired:false, modelSelect:true, modelCatalogueRequired:true, modelSelectLabel:'Ollama model', supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, supportsJsonMode:true, thinkingPromptGuard:true, thinkingModes:{off:{reasoning_effort:'none'},on:{reasoning_effort:'medium'}}, requestTimeoutMs:300000, connectionTestTimeoutMs:15000,
      note:'Ollama OpenAI-compatible endpoint.'
    },
    lmstudio: {
      id:'lmstudio', name:'LM Studio', local:true, endpoint:'http://127.0.0.1:1234/v1', model:'local-model', keyRequired:false, optionalKey:true, modelSelect:true, modelCatalogueRequired:true, modelSelectLabel:'LM Studio model', supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, supportsJsonMode:true, supportsJsonSchema:true, jsonSchemaStrict:false, thinkingPromptGuard:true, thinkingModes:{off:{reasoning_effort:'none',chat_template_kwargs:{enable_thinking:false,reasoning_effort:'none'}},on:{reasoning_effort:'medium',chat_template_kwargs:{enable_thinking:true,reasoning_effort:'medium'}}}, requestTimeoutMs:300000, connectionTestTimeoutMs:15000,
      note:'LM Studio OpenAI-compatible endpoint.'
    },
    llamacpp: {
      id:'llamacpp', name:'llama.cpp', local:true, endpoint:'http://127.0.0.1:8080/v1', model:'local-model', keyRequired:false, optionalKey:true, modelSelect:true, modelCatalogueRequired:true, modelSelectLabel:'llama.cpp model', supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, supportsJsonMode:true, requestTimeoutMs:300000, connectionTestTimeoutMs:15000, connectionTestMaxTokens:64, connectionTestAcceptReasoningOnly:true, safeThinkingOverrideWhenUnknown:true, supportsReasoningControl:true, thinkingPromptGuard:true, recommendedRuntime:{parallelSlots:1,contextWindow:65536}, thinkingModes:{off:{reasoning_effort:'none',chat_template_kwargs:{enable_thinking:false,reasoning_effort:'none'}},on:{reasoning_effort:'medium',chat_template_kwargs:{enable_thinking:true,reasoning_effort:'medium'}}},
      note:'llama.cpp llama-server OpenAI-compatible endpoint.'
    },
    custom: {
      id:'custom', name:'Custom OpenAI-compatible', endpoint:'', model:'', keyRequired:false, optionalKey:true, supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true,
      note:'Set endpoint and model manually.'
    }
  };
  LF.AIProviderList = Object.keys(LF.AIProviders).map(function(id){return LF.AIProviders[id];});
  if(LF.Logger) LF.Logger.info('providers','registry.ready',{defaultProvider:'zai',defaultModel:'glm-4.7-flash',providers:LF.AIProviderList.map(function(p){return{id:p.id,name:p.name,model:p.model,endpoint:p.endpoint,keyRequired:p.keyRequired};})});
}());
