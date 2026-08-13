(function () {
  'use strict';
  /* Provider capabilities are declarative transport metadata. Prompts and
     scientific semantics never belong in this registry. */
  const LF = window.LabFlow = window.LabFlow || {};
  LF.AIProviders = {
    zai: {
      id:'zai', name:'Z.AI', endpoint:'https://api.z.ai/api/paas/v4/chat/completions', model:'glm-4.7-flash', keyRequired:true, supportsThinking:true, supportsJsonMode:true, supportsStreaming:true, supportsStreamUsage:true, tokenParam:'max_tokens', supportsTemperature:true, connectionTestTimeoutMs:60000,
      note:'Default. Z.AI general Chat Completions endpoint.'
    },
    openai: {
      id:'openai', name:'OpenAI', endpoint:'https://api.openai.com/v1/chat/completions', model:'gpt-5-mini', keyRequired:true, supportsStreaming:true, supportsStreamUsage:true, tokenParam:'max_completion_tokens', supportsTemperature:false,
      note:'OpenAI Chat Completions compatible endpoint.'
    },
    gemini: {
      id:'gemini', name:'Google Gemini', endpoint:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model:'gemini-3.6-flash', keyRequired:true, supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true,
      note:'Gemini OpenAI-compatibility endpoint.'
    },
    ollama: {
      id:'ollama', name:'Ollama (local)', endpoint:'http://127.0.0.1:11434/v1', model:'gemma3', keyRequired:false, supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, supportsJsonMode:true, reasoningEffort:'none', requestTimeoutMs:180000, connectionTestTimeoutMs:60000,
      note:'Local OpenAI-compatible endpoint. LabFlow resolves the base URL to /v1/chat/completions. When opened in a browser, the provider must allow the page origin.'
    },
    lmstudio: {
      id:'lmstudio', name:'LM Studio (local)', endpoint:'http://127.0.0.1:1234/v1', model:'local-model', keyRequired:false, supportsStreaming:true, tokenParam:'max_tokens', supportsTemperature:true, supportsJsonSchema:true, requestTimeoutMs:180000, connectionTestTimeoutMs:60000,
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
